// Entry point so `node --test money/tests/` works on Node 22+, where a bare
// directory argument is resolved as a module (→ this file) instead of being
// scanned. Older Node versions scan the folder and run the *.test.mjs files
// directly (this file doesn't match the test-file patterns there).
const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { pathToFileURL } = require('node:url');

for (const f of readdirSync(__dirname).filter((n) => n.endsWith('.test.mjs')).sort()) {
  import(pathToFileURL(join(__dirname, f)).href);
}
