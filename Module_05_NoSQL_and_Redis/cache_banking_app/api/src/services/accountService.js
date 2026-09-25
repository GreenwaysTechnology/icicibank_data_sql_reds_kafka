/**
 * services/accountService.js - business logic for accounts and statements.
 * Services decide WHAT to cache; cacheService decides HOW.
 */
import * as accounts from '../repositories/accountRepository.js';
import * as txns from '../repositories/transactionRepository.js';
import * as cache from '../cache/cacheService.js';
import { config } from '../config/index.js';
import { HttpError } from '../middleware/errors.js';

export const loadAccounts = (customerId) => accounts.findAccountsByCustomer(customerId);
export const loadStatement = (accountNo) => txns.findRecent(accountNo, config.cache.statementSize);

export async function getCustomer(customerId) {
  const c = await accounts.findCustomer(customerId);
  if (!c) throw new HttpError(404, `Customer ${customerId} not found`);
  return c;
}

/**
 * Account list with balances - cached as bank:accounts:<customerId>.
 * Existence is checked only on a MISS: a HIT must not touch PostgreSQL at all.
 */
export async function getAccounts(customerId) {
  return cache.getOrLoad(cache.keys.accounts(customerId), async () => {
    await getCustomer(customerId);
    return loadAccounts(customerId);
  });
}

/** Recent transactions - cached as bank:txns:<accountNo>. */
export async function getStatement(accountNo) {
  return cache.getOrLoad(cache.keys.statement(accountNo), async () => {
    if (!(await accounts.findAccountHolder(accountNo))) {
      throw new HttpError(404, `Account ${accountNo} not found`);
    }
    return loadStatement(accountNo);
  });
}

/** Beneficiary lookup - not cached; it is only used once per transfer. */
export async function lookupAccount(accountNo) {
  const a = await accounts.findAccountHolder(accountNo);
  if (!a) throw new HttpError(404, `No account ${accountNo} at Horizon Bank`);
  const [first, ...rest] = a.holderName.split(' ');
  return {
    accountNo: a.accountNo,
    holderName: `${first} ${rest.map((r) => `${r[0]}.`).join(' ')}`.trim(),
    branch: a.branch,
    ifsc: a.ifsc,
    status: a.status,
  };
}
