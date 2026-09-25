/**
 * repositories/accountRepository.js - SQL for customers and accounts.
 * Repositories only talk to PostgreSQL; they know nothing about Redis.
 */
import { query } from '../infra/db.js';

export async function findCustomer(customerId) {
  const { rows } = await query(
    `SELECT customer_id AS "customerId", full_name AS "fullName", email, mobile, city
       FROM customers WHERE customer_id = $1`,
    [customerId],
  );
  return rows[0] ?? null;
}

export async function findAccountsByCustomer(customerId) {
  const { rows } = await query(
    `SELECT account_no AS "accountNo", account_type AS "accountType", branch, ifsc,
            balance, status, opened_on AS "openedOn"
       FROM accounts
      WHERE customer_id = $1
      ORDER BY account_no`,
    [customerId],
  );
  return rows;
}

/** Beneficiary lookup - returns the holder's name for a confirmation screen. */
export async function findAccountHolder(accountNo) {
  const { rows } = await query(
    `SELECT a.account_no AS "accountNo", a.account_type AS "accountType", a.branch, a.ifsc,
            a.status, a.customer_id AS "customerId", c.full_name AS "holderName"
       FROM accounts a JOIN customers c ON c.customer_id = a.customer_id
      WHERE a.account_no = $1`,
    [accountNo],
  );
  return rows[0] ?? null;
}

/** Lock both rows for the rest of the DB transaction, always in the same order. */
export async function lockAccounts(client, accountNos) {
  const { rows } = await client.query(
    `SELECT account_no AS "accountNo", customer_id AS "customerId", balance, status
       FROM accounts
      WHERE account_no = ANY($1)
      ORDER BY account_no
        FOR UPDATE`,
    [accountNos],
  );
  return rows;
}

export async function addToBalance(client, accountNo, delta) {
  const { rows } = await client.query(
    `UPDATE accounts SET balance = balance + $2 WHERE account_no = $1 RETURNING balance`,
    [accountNo, delta],
  );
  return rows[0].balance;
}
