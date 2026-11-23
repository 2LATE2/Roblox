// Syntax check for the Luau sources (written in Lua 5.1-compatible syntax).
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const luaparse = require('luaparse');
let bad = 0;
for (const f of process.argv.slice(2)) {
  try {
    luaparse.parse(fs.readFileSync(f, 'utf8'), { luaVersion: '5.1' });
    console.log('ok  ', f);
  } catch (e) {
    bad++;
    console.log('FAIL', f, e.message);
  }
}
process.exit(bad ? 1 : 0);
