/**
 * Shared connection helper and a tiny console formatter.
 *
 * Every recipe imports from here so that the Redis connection is set up in
 * exactly one place, and so the output of all fifteen programs looks the same.
 *
 * Override the server with an environment variable:
 *   REDIS_URL=redis://10.2.4.9:6379 node src/01_string_hit_counter.js
 */
import { createClient } from 'redis';

export const REDIS_URL = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';

/** Connect and hand back a ready client. */
export async function connect() {
  const client = createClient({
    url: REDIS_URL,
    socket: {
      connectTimeout: 3_000,
      // By default node-redis retries a lost connection forever, which is what
      // you want in a long-running service and NOT what you want in a teaching
      // script - it would sit there printing ECONNREFUSED until you kill it.
      // Returning an Error from the strategy gives up and rejects connect().
      reconnectStrategy: (retries) =>
        (retries > 3 ? new Error('gave up reconnecting') : Math.min(retries * 200, 1_000)),
    },
  });

  // Without a listener, a connection error becomes an unhandled 'error' event
  // and takes the process down. Always attach one.
  client.on('error', (err) => {
    if (client.isReady) console.error('  redis error:', err.message);
  });

  await client.connect();
  return client;
}

/**
 * Connect, run the recipe, disconnect - even if the recipe throws.
 * This is the entry point every file at the bottom of src/ calls.
 */
export async function main(recipe) {
  let client;
  try {
    client = await connect();
  } catch (err) {
    console.error(`\nCannot reach Redis at ${REDIS_URL}\n  ${err.message}\n`);
    console.error('Start one with:  docker run -d -p 6379:6379 redis:7-alpine\n');
    process.exitCode = 2;
    return;
  }

  try {
    await recipe(client);
  } catch (err) {
    console.error('\nRecipe failed:', err.message);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

/* ------------------------------------------------------------------ */
/* Output helpers - narration only, no logic                           */
/* ------------------------------------------------------------------ */

const W = 72;

export function banner(no, structure, useCase) {
  console.log('\n' + '='.repeat(W));
  console.log(`  ${no} · ${structure.toUpperCase()}  —  ${useCase}`);
  console.log('='.repeat(W));
}

/** A numbered section inside a recipe. */
export function step(text) {
  console.log(`\n▸ ${text}`);
}

/** Print a Redis command and the reply it produced. */
export function cmd(command, reply) {
  console.log(`    ${command}`);
  if (reply !== undefined) console.log(`      → ${format(reply)}`);
}

/** Print a plain observation. */
export function say(text) {
  console.log(`    ${text}`);
}

/** Print the takeaway at the end of a recipe. */
export function takeaway(text) {
  console.log(`\n  TAKEAWAY  ${text}\n`);
}

function format(v) {
  if (v === null) return '(nil)';
  if (typeof v === 'boolean') return v ? 'OK' : '(nil)';
  if (Array.isArray(v)) return JSON.stringify(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wipe only the keys this cookbook creates, so reruns start clean. */
export async function reset(client, pattern) {
  const doomed = [];
  for await (const keys of client.scanIterator({ MATCH: pattern, COUNT: 500 })) {
    doomed.push(...keys);
  }
  if (doomed.length) await client.unlink(doomed);
  return doomed.length;
}
