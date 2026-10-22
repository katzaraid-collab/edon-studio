// Render the motion compositor (motion/index.html) to video.
// Usage:
//   node motion_render.js MOTION_DIR OUT.mp4 SECONDS          full render (silent)
//   node motion_render.js MOTION_DIR STILLS_DIR stills t1 t2  PNG stills at given times
// Workers render contiguous chunks and pipe JPEG (q95) frames straight into ffmpeg;
// PNG screenshots cost ~0.5 s each in the browser process, JPEG ~0.06 s.
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const [dir, out, mode, ...rest] = process.argv.slice(2);
const FPS = 30;
const WORKERS = 4;

async function openPage(browser) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await page.goto("file://" + path.resolve(dir, "index.html"));
  await page.evaluate(() => window.READY);
  return page;
}

async function stills(browser, times) {
  fs.mkdirSync(out, { recursive: true });
  const page = await openPage(browser);
  for (const t of times) {
    await page.evaluate((t) => window.seek(t), Number(t));
    await page.screenshot({ path: path.join(out, `t${Number(t).toFixed(2)}.png`) });
  }
}

function encoder(file) {
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg",
    "-i", "-", "-c:v", "libx264", "-preset", "fast", "-crf", "12", "-pix_fmt", "yuv420p", "-r", String(FPS), file],
    { stdio: ["pipe", "inherit", "inherit"] });
  const done = new Promise((res, rej) => ff.on("close", c => c === 0 ? res() : rej(new Error("ffmpeg " + c))));
  return { ff, done };
}

async function full(browser, seconds) {
  const total = Math.round(seconds * FPS);
  const tmp = out + ".chunks";
  fs.mkdirSync(tmp, { recursive: true });
  const per = Math.ceil(total / WORKERS);
  const files = [];
  const t0 = Date.now();
  await Promise.all(Array.from({ length: WORKERS }, async (_, w) => {
    const a = w * per, b = Math.min(total, a + per);
    if (a >= b) return;
    const file = path.join(tmp, `c${w}.mp4`);
    files[w] = file;
    const page = await openPage(browser);
    const { ff, done } = encoder(file);
    for (let n = a; n < b; n++) {
      await page.evaluate((t) => window.seek(t), n / FPS);
      const buf = await page.screenshot({ type: "jpeg", quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once("drain", r));
      if (w === 0 && (n - a) % 30 === 0) console.log(`chunk0 ${n - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end();
    await done;
    await page.close();
  }));
  const list = path.join(tmp, "list.txt");
  fs.writeFileSync(list, files.filter(Boolean).map(f => `file '${f}'`).join("\n"));
  await new Promise((res, rej) => spawn("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", out],
    { stdio: "inherit" }).on("close", c => c === 0 ? res() : rej(new Error("concat " + c))));
  console.log("rendered", total, "frames in", ((Date.now() - t0) / 1000).toFixed(0), "s");
}

(async () => {
  const browser = await chromium.launch({ args: ["--allow-file-access-from-files"] });
  try {
    if (mode === "stills") await stills(browser, rest);
    else await full(browser, Number(mode));
  } finally {
    await browser.close();
  }
})();
