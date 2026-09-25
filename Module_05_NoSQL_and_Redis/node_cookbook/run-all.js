/**
 * Runs every program in src/, one after another.
 *
 *   node run-all.js          run all 15
 *   node run-all.js 03 07    run only 03 and 07
 *
 * This file is a helper, not a lesson. You do not need to understand it
 * to learn Redis - just use it.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

// Find all the lesson files, in number order.
const files = readdirSync('src').filter((name) => name.endsWith('.js')).sort();

// If numbers were given on the command line, keep only those files.
const wanted = process.argv.slice(2);
const toRun = wanted.length === 0
  ? files
  : files.filter((name) => wanted.includes(name.slice(0, 2)));

if (toRun.length === 0) {
  console.log('No programs matched:', wanted.join(' '));
  process.exit(1);
}

const failed = [];

for (const file of toRun) {
  console.log('\n==================================================');
  console.log('  RUNNING  src/' + file);
  console.log('==================================================');

  const result = spawnSync('node', ['src/' + file], { stdio: 'inherit' });

  if (result.status !== 0) {
    failed.push(file);
  }
}

console.log('\n==================================================');
console.log('  ' + (toRun.length - failed.length) + ' of ' + toRun.length + ' programs ran successfully');
if (failed.length > 0) {
  console.log('  Failed: ' + failed.join(', '));
  console.log('  Is Redis running? Try:  docker run -d -p 6379:6379 redis:7-alpine');
}
console.log('==================================================\n');
