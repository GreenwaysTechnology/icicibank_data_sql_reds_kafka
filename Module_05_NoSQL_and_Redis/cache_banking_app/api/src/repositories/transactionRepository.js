/**
 * repositories/transactionRepository.js - SQL for the transactions table.
 */
import { query } from '../infra/db.js';

export async function findRecent(accountNo, limit) {
  const { rows } = await query(
    `SELECT txn_id AS "txnId", txn_type AS "type", amount, balance_after AS "balanceAfter",
            channel, description, counterparty_acc AS "counterparty",
            reference_no AS "reference", created_at AS "createdAt"
       FROM transactions
      WHERE account_no = $1
      ORDER BY created_at DESC, txn_id DESC
      LIMIT $2`,
    [accountNo, limit],
  );
  return rows;
}

export async function insert(client, t) {
  const { rows } = await client.query(
    `INSERT INTO transactions
            (account_no, txn_type, amount, balance_after, channel, description,
             counterparty_acc, reference_no)
     VALUES ($1, $2, $3, $4, 'TRF', $5, $6, $7)
     RETURNING txn_id AS "txnId", created_at AS "createdAt"`,
    [t.accountNo, t.type, t.amount, t.balanceAfter, t.description, t.counterparty, t.reference],
  );
  return rows[0];
}
