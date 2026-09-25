/**
 * Exercise 5 — otp.js
 * OTP issue, verify, and lock-out after three wrong attempts.
 *
 *   node exercises/ex05_otp.js
 *
 * Three keys, all of them with a TTL:
 *   icici:otp:<mobile>         the code            90s
 *   icici:otp:tries:<mobile>   wrong attempts      90s, armed once
 *   icici:otp:lock:<mobile>    the lock-out       300s
 */
import { main, banner, step, cmd, say, takeaway } from '../src/_client.js';

const TTL = 90;
const MAX = 3;
const LOCK = 300;

const otpKey = (m) => `icici:otp:${m}`;
const tryKey = (m) => `icici:otp:tries:${m}`;
const lockKey = (m) => `icici:otp:lock:${m}`;

export async function issue(client, mobile) {
  const code = String(Math.floor(100_000 + Math.random() * 900_000));
  await client
    .multi()
    .set(otpKey(mobile), code, { EX: TTL })
    .unlink(tryKey(mobile)) // a new OTP resets the attempt count
    .unlink(lockKey(mobile))
    .exec();
  return code;
}

export async function verify(client, mobile, code) {
  if (await client.exists(lockKey(mobile))) return 'LOCKED';

  const stored = await client.get(otpKey(mobile));
  if (stored === null) return 'EXPIRED';

  if (stored === code) {
    // Consume it. UNLINK returns 1 only for the caller that actually removed
    // the key, so two devices verifying at the same instant cannot both get OK.
    const won = await client.unlink(otpKey(mobile));
    await client.unlink(tryKey(mobile));
    return won === 1 ? 'OK' : 'EXPIRED';
  }

  // Wrong code. INCR returns the number we branch on - never GET then decide,
  // or two concurrent attempts both read 2 and the customer gets four tries.
  const [tries] = await client
    .multi()
    .incr(tryKey(mobile))
    .expire(tryKey(mobile), TTL, 'NX') // arm once; a later attempt cannot extend it
    .exec();

  if (Number(tries) >= MAX) {
    await client
      .multi()
      .set(lockKey(mobile), '1', { EX: LOCK })
      .unlink(otpKey(mobile))
      .exec();
    return 'LOCKED';
  }
  return 'WRONG';
}

async function recipe(client) {
  banner('EX05', 'String', 'OTP issue, verify and lock-out');
  const mobile = '9876543210';
  await client.unlink([otpKey(mobile), tryKey(mobile), lockKey(mobile)]);

  step('Issue');
  const code = await issue(client, mobile);
  cmd(`SET ${otpKey(mobile)} ${code} EX ${TTL}`, 'OK');
  say(`issued ${code}   TTL ${await client.ttl(otpKey(mobile))}s`);

  step('One wrong attempt, then the right code');
  say(`verify 000000  → ${await verify(client, mobile, '000000')}    (attempt 1 of ${MAX})`);
  say(`verify ${code}  → ${await verify(client, mobile, code)}`);

  step('Replay the code that just worked');
  say(`verify ${code}  → ${await verify(client, mobile, code)}  (consumed, cannot be reused)`);

  step('Three wrong attempts against a fresh OTP');
  await issue(client, mobile);
  for (let i = 1; i <= 3; i += 1) {
    say(`  attempt ${i}: ${await verify(client, mobile, '111111')}`);
  }
  cmd(`TTL ${lockKey(mobile)}`, await client.ttl(lockKey(mobile)));
  say(`even the right code now → ${await verify(client, mobile, 'whatever')}`);

  step('Nothing is left behind');
  for (const k of [otpKey(mobile), tryKey(mobile), lockKey(mobile)]) {
    say(`  ${k.padEnd(34)} ttl ${await client.ttl(k)}`);
  }
  say('-2 = the key is gone, -1 = no TTL (would be a bug), >0 = expiring on its own');

  takeaway(
    'Branch on what INCR returns, consume the OTP with UNLINK\'s 1/0 reply, and '
    + 'give every one of the three keys a TTL.',
  );
}

main(recipe);
