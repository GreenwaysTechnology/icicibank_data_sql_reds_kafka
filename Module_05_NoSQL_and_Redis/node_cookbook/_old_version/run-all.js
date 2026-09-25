/**
 * Run every recipe in order, each in its own process.
 *
 *   node run-all.js            all fifteen
 *   node run-all.js 04 07 12   just those
 *
 * A recipe that fails does not stop the ones after it; the exit code at the
 * end tells you whether anything went wrong.
 */
import { readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, 'src');

const wanted = process.argv.slice(2);
const recipes = readdirSync(srcDir)
  .filter((f) => /^\d\d_.*\.js$/.test(f))
  .sort()
  .filter((f) => wanted.length === 0 || wanted.includes(f.slice(0, 2)));

if (recipes.length === 0) {
  console.error(`No recipes matched ${wanted.join(', ')}`);
  process.exit(1);
}

const run = (file) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [join(srcDir, file)], { stdio: 'inherit' });
    child.on('close', (code) => resolve({ file, code }));
  });

const results = [];
for (const file of recipes) {
  results.push(await run(file));
}

console.log('\n' + '='.repeat(72));
console.log('  SUMMARY');
console.log('='.repeat(72));
for (const { file, code } of results) {
  console.log(`  ${code === 0 ? 'ok  ' : 'FAIL'}  ${file}${code === 0 ? '' : `  (exit ${code})`}`);
}

const failed = results.filter((r) => r.code !== 0).length;
console.log(`\n  ${results.length - failed}/${results.length} recipes completed\n`);
process.exit(failed ? 1 : 0);
