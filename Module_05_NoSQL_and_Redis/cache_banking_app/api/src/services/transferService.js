/**
 * services/transferService.js - move money between two accounts.
 *
 * Order matters:
 *   1. PostgreSQL transaction: lock both rows, check funds, update balances,
 *      insert a DEBIT and a CREDIT row, COMMIT.
 *   2. Only after COMMIT, update the cache for everything that changed:
 *        bank:txns:<from>   bank:txns:<to>
 *        bank:accounts:<from-owner>   bank:accounts:<to-owner>
 *   Updating Redis before COMMIT could publish a transfer that then rolls back.
 */
import { randomInt } from 'node:crypto';
import { withTransaction } from '../infra/db.js';
import * as accounts from '../repositories/accountRepository.js';
import * as txns from '../repositories/transactionRepository.js';
import * as cache from '../cache/cacheService.js';
import { loadAccounts, loadStatement } from './accountService.js';
import { config } from '../config/index.js';
import { HttpError } from '../middleware/errors.js';

const MAX_PER_TRANSFER = 200000;

function validate({ fromAccount, toAccount, amount }) {
  if (!fromAccount || !toAccount) throw new HttpError(400, 'fromAccount and toAccount are required');
  if (fromAccount === toAccount) throw new HttpError(400, 'Cannot transfer to the same account');
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new HttpError(400, 'Amount must be greater than zero');
  if (Math.round(amt * 100) !== amt * 100) throw new HttpError(400, 'Amount can have at most 2 decimals');
  if (amt > MAX_PER_TRANSFER) {
    throw new HttpError(400, `Maximum per transfer is Rs ${MAX_PER_TRANSFER.toLocaleString('en-IN')}`);
  }
  return amt;
}

export async function transfer(input) {
  const amount = validate(input);
  const { fromAccount, toAccount } = input;
  const remarks = (input.remarks ?? '').toString().slice(0, 40).trim();
  const reference = `TRF${Date.now().toString().slice(-9)}${randomInt(100, 999)}`;

  // ---- 1. the database is the source of truth ---------------------------------
  const result = await withTransaction(async (client) => {
    const locked = await accounts.lockAccounts(client, [fromAccount, toAccount]);
    const from = locked.find((a) => a.accountNo === fromAccount);
    const to = locked.find((a) => a.accountNo === toAccount);
    if (!from) throw new HttpError(404, `Account ${fromAccount} not found`);
    if (!to) throw new HttpError(404, `Beneficiary account ${toAccount} not found`);
    if (from.status !== 'ACTIVE' || to.status !== 'ACTIVE') {
      throw new HttpError(409, 'One of the accounts is not active');
    }
    if (from.balance < amount) {
      throw new HttpError(422, `Insufficient balance. Available: Rs ${from.balance.toLocaleString('en-IN')}`);
    }

    const fromBalance = await accounts.addToBalance(client, fromAccount, -amount);
    const toBalance = await accounts.addToBalance(client, toAccount, amount);
    const note = remarks ? ` - ${remarks}` : '';
    const debit = await txns.insert(client, {
      accountNo: fromAccount, type: 'DEBIT', amount, balanceAfter: fromBalance,
      description: `TRF/To ${toAccount}${note}`, counterparty: toAccount, reference,
    });
    await txns.insert(client, {
      accountNo: toAccount, type: 'CREDIT', amount, balanceAfter: toBalance,
      description: `TRF/From ${fromAccount}${note}`, counterparty: fromAccount, reference,
    });
    return {
      reference, amount, fromAccount, toAccount, fromBalance,
      createdAt: debit.createdAt, owners: [...new Set([from.customerId, to.customerId])],
    };
  });

  // ---- 2. then bring the cache up to date ------------------------------------
  const cacheUpdates = await updateCache(result);
  const { owners, ...receipt } = result;
  return { ...receipt, cacheUpdates };
}

async function updateCache({ fromAccount, toAccount, owners }) {
  try {
    if (config.cache.onWrite === 'invalidate') {
      return await cache.invalidate(
        cache.keys.statement(fromAccount),
        cache.keys.statement(toAccount),
        ...owners.map((c) => cache.keys.accounts(c)),
      );
    }
    const jobs = [
      cache.refresh(cache.keys.statement(fromAccount), () => loadStatement(fromAccount)),
      cache.refresh(cache.keys.statement(toAccount), () => loadStatement(toAccount)),
      ...owners.map((c) => cache.refresh(cache.keys.accounts(c), () => loadAccounts(c))),
    ];
    return (await Promise.all(jobs)).filter(Boolean);
  } catch (err) {
    // The money has moved; a failed cache update must not fail the transfer.
    // Try to delete the keys so no stale balance is served; TTL cleans up the rest.
    console.error('[cache] update after transfer failed:', err.message);
    return cache.invalidate(
      cache.keys.statement(fromAccount),
      cache.keys.statement(toAccount),
      ...owners.map((c) => cache.keys.accounts(c)),
    ).catch(() => []);
  }
}
