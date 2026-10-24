// Rewrites b.html (read fresh on every request) into "the site": only the full-screen overlay
// mount, opened at DOMContentLoaded, presentation chrome hidden. 'opt' also applies the
// recommended image + font markup from markup.js so before/after are measured the same way.
const markup = require('./markup.js');

function base(src) {
  let html = src;
  html = html.replace(/<header class="topbar">[\s\S]*?<\/header>/, '');
  html = html.replace(/<main id="main">[\s\S]*?<\/main>/,
    '<main id="main"><h1 hidden>השקית</h1><button type="button" data-full hidden></button></main>');
  html = html.replace('</head>', '<style>.fs-bar{display:none!important}</style>\n</head>');
  html = html.replace('</body>',
    '<script>document.addEventListener("DOMContentLoaded",function(){var b=document.querySelector("[data-full]");if(b)b.click();});</script>\n</body>');
  return html;
}

function must(html, from, to, label) {
  if (!html.includes(from)) throw new Error('harness: pattern not found for ' + label);
  return html.replace(from, to);
}

function opt(html, variant) {
  const lq = variant === 'opt' || variant === 'opt-nf' || variant.startsWith('opt-b');
  const m = markup.slots({ lqip: lq });
  // fonts
  if (variant !== 'opt-img') {
    html = html.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, m.fontLink);
    // the prototype mounts from <template>, so the preload scanner can't see the hero: preload it
    html = html.replace('<link rel="stylesheet" href="shell.css">', m.heroPreload + '\n<link rel="stylesheet" href="shell.css">');
  }
  html = html.replace('</head>', m.lqipCss + '\n</head>');   // picture{display:contents} (+ LQIP rules in 'opt')
  for (const s of m.list) html = must(html, s.find, s.replace, s.slot);
  if (lq) html = html.replace('</body>', m.lqipJs + '\n</body>');
  // test of the recommended motion fix: the LCP image keeps its push-in but drops the opacity fade
  if (variant.startsWith('opt-b')) {
    const pre = variant === 'opt-bnf-p0' ? '' : variant === 'opt-bnf-p1' ? markup.fontPreloadB('fonts/').split('\n')[0] : markup.fontPreloadB('fonts/');
    html = html.replace(m.fontLink, pre + '\n<style>' + markup.fontFaceB('fonts/') + '</style>');
    html = html.replace(/<link rel="preconnect"[^>]*>\n?/g, '');
  }
  if (variant === 'opt-nf' || variant.startsWith('opt-bnf')) html = html.replace('</head>', '<style>' + markup.NOFADE + '</style>\n</head>');
  return html;
}

exports.build = function (src, variant) {
  const html = base(src);
  return variant === 'full' ? html : opt(html, variant);
};
