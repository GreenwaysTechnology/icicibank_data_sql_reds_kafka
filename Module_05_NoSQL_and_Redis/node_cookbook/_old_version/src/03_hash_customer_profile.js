/**
 * 03 · HASH · Customer profile cache
 * ---------------------------------------------------------------------
 * Use case    Cache the customer profile that every screen in the mobile
 *             app needs - name, tier, branch, KYC state, login count.
 * Structure   Hash: one key, many fields, each field readable and writable
 *             on its own.
 * Commands    HSET · HGET · HMGET · HGETALL · HINCRBY · HDEL · HEXISTS
 *             OBJECT ENCODING · MEMORY USAGE
 * Why Redis   A JSON string forces read-parse-modify-serialise-write for a
 *             one-field change, and two servers doing that at once lose an
 *             update. A Hash updates one field atomically, server side.
 * Run         node src/03_hash_customer_profile.js
 */
import { main, banner, step, cmd, say, takeaway, reset } from './_client.js';

const key = (id) => `icici:cust:${id}`;

async function recipe(client) {
  banner('03', 'Hash', 'Customer profile cache');
  await reset(client, 'icici:cust:*');

  step('The version a developer writes first: one JSON string');
  const json = JSON.stringify({ name: 'A. Sharma', tier: 'gold', logins: 41 });
  await client.set('icici:cust:json:9003', json);
  cmd('SET icici:cust:json:9003 \'{"name":"A. Sharma",...}\'', 'OK');
  say('To bump the login count: GET, JSON.parse, ++, JSON.stringify, SET.');
  say('Two app servers doing that at the same moment - one increment vanishes.');

  step('The same profile as a Hash - one command');
  const created = await client.hSet(key(9003), {
    name: 'A. Sharma',
    tier: 'gold',
    logins: '41',
    branch: 'BR-MUM-014',
    mobile: '98xxxxxx21',
    kyc: 'verified',
  });
  cmd(`HSET ${key(9003)} name "A. Sharma" tier gold logins 41 ...`, created);
  say('The reply is the number of NEW fields. Re-running it returns 0 - the');
  say('values are updated, nothing is duplicated.');

  step('Read one field, not the whole document');
  cmd(`HGET ${key(9003)} tier`, await client.hGet(key(9003), 'tier'));
  cmd(
    `HMGET ${key(9003)} name tier branch`,
    await client.hmGet(key(9003), ['name', 'tier', 'branch']),
  );
  say('The mobile screen needs three fields. It transfers three fields.');

  step('Increment a counter inside the profile - atomically');
  const logins = await client.hIncrBy(key(9003), 'logins', 1);
  cmd(`HINCRBY ${key(9003)} logins 1`, logins);
  say('No read, no parse, no write-back. The lost-update bug is gone by');
  say('construction, not by being careful.');

  step('Promote the customer and drop a field');
  await client.hSet(key(9003), 'tier', 'platinum');
  await client.hDel(key(9003), 'mobile');
  cmd(`HEXISTS ${key(9003)} mobile`, await client.hExists(key(9003), 'mobile'));
  const all = await client.hGetAll(key(9003));
  cmd(`HGETALL ${key(9003)}`, all);
  say('HGETALL returns a plain JavaScript object - no parsing on your side.');
  say('Avoid it on hashes with thousands of fields; prefer HMGET or HSCAN.');

  step('What it costs, and the one number that decides it');
  const smallEnc = await client.objectEncoding(key(9003));
  const smallMem = await client.memoryUsage(key(9003));
  cmd(`OBJECT ENCODING ${key(9003)}`, smallEnc);
  cmd(`MEMORY USAGE ${key(9003)}`, `${smallMem} bytes`);
  say('"listpack" - a small Hash is a flat, contiguous block of field/value');
  say('pairs scanned linearly. It is not a hash table at all, and at six');
  say('fields that is both faster and far smaller than one.');

  step('Cross the threshold and watch the encoding flip');
  const limit = await client.configGet('hash-max-listpack-entries');
  cmd('CONFIG GET hash-max-listpack-entries', limit['hash-max-listpack-entries']);
  const bulk = client.multi();
  for (let i = 0; i < 200; i += 1) bulk.hSet(key(9003), `f${i}`, `v${i}`);
  await bulk.exec();
  const bigEnc = await client.objectEncoding(key(9003));
  const bigMem = await client.memoryUsage(key(9003));
  cmd(`OBJECT ENCODING ${key(9003)}`, bigEnc);
  cmd(`MEMORY USAGE ${key(9003)}`, `${bigMem} bytes`);
  say(`${smallMem} bytes → ${bigMem} bytes. Past the threshold every field and`);
  say('value becomes its own allocation with its own header and pointers.');
  say('The conversion is one-way: deleting fields does not convert it back.');

  takeaway(
    'A record whose fields are updated independently is a Hash, never a JSON '
    + 'string. Keep each Hash under hash-max-listpack-entries and it is also '
    + 'the cheapest way to store millions of records.',
  );
}

main(recipe);
