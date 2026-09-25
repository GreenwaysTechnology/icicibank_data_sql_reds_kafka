-- ---------------------------------------------------------------------------
-- Horizon Bank (training app) - schema
-- Three tables only: customers -> accounts -> transactions
-- Runs automatically the first time the postgres container starts
-- (anything in /docker-entrypoint-initdb.d is executed in name order).
-- ---------------------------------------------------------------------------

CREATE TABLE customers (
    customer_id   SERIAL PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(120) NOT NULL UNIQUE,
    mobile        VARCHAR(15)  NOT NULL,
    city          VARCHAR(60)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE accounts (
    account_no    VARCHAR(14)   PRIMARY KEY,
    customer_id   INT           NOT NULL REFERENCES customers(customer_id),
    account_type  VARCHAR(20)   NOT NULL CHECK (account_type IN ('SAVINGS', 'SALARY', 'CURRENT')),
    branch        VARCHAR(60)   NOT NULL,
    ifsc          VARCHAR(11)   NOT NULL,
    balance       NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    status        VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE',
    opened_on     DATE          NOT NULL
);

CREATE TABLE transactions (
    txn_id           BIGSERIAL     PRIMARY KEY,
    account_no       VARCHAR(14)   NOT NULL REFERENCES accounts(account_no),
    txn_type         VARCHAR(6)    NOT NULL CHECK (txn_type IN ('DEBIT', 'CREDIT')),
    amount           NUMERIC(14,2) NOT NULL CHECK (amount > 0),
    balance_after    NUMERIC(14,2),
    channel          VARCHAR(10)   NOT NULL,          -- UPI, NEFT, IMPS, ATM, POS, NACH, INT, TRF
    description      VARCHAR(120)  NOT NULL,
    counterparty_acc VARCHAR(14),                     -- set for internal transfers
    reference_no     VARCHAR(24)   NOT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- The statement query is always "one account, newest first"
CREATE INDEX idx_txn_account_time ON transactions (account_no, created_at DESC, txn_id DESC);
CREATE INDEX idx_accounts_customer ON accounts (customer_id);
