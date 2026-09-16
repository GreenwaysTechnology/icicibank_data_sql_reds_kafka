-- =====================================================================
--  ICICI BANK  |  Core Banking Schema  |  ORACLE
--  Enterprise Data Engineering with SQL, Redis & Kafka
--  Run this ONCE before Module 2. Every module builds on these tables.
-- =====================================================================

BEGIN EXECUTE IMMEDIATE 'DROP TABLE employee CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE beneficiary CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE card CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE loan_payment CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE loan CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE account_txn CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE account CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE customer CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/
BEGIN EXECUTE IMMEDIATE 'DROP TABLE branch CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
/

-- BRANCH : Physical ICICI Bank branches
CREATE TABLE branch (
    branch_id              NUMBER(10)       NOT NULL,
    branch_name            VARCHAR2(60)     NOT NULL,
    ifsc_code              CHAR(11)         NOT NULL UNIQUE,
    city                   VARCHAR2(40)     NOT NULL,
    state                  VARCHAR2(40)     NOT NULL,
    opened_date            DATE             NOT NULL,
    CONSTRAINT pk_branch PRIMARY KEY (branch_id)
);

-- CUSTOMER : Every individual who banks with ICICI Bank
CREATE TABLE customer (
    customer_id            NUMBER(10)       NOT NULL,
    first_name             VARCHAR2(40)     NOT NULL,
    last_name              VARCHAR2(40)     NOT NULL,
    date_of_birth          DATE             NOT NULL,
    email                  VARCHAR2(80)     NULL UNIQUE,
    phone                  VARCHAR2(15)     NOT NULL,
    city                   VARCHAR2(40)     NULL,
    kyc_status             VARCHAR2(12)     DEFAULT 'PENDING' NOT NULL,
    risk_rating            VARCHAR2(10)     NULL,
    customer_since         DATE             NOT NULL,
    home_branch_id         NUMBER(10)       NOT NULL,
    CONSTRAINT pk_customer PRIMARY KEY (customer_id),
    CONSTRAINT fk_customer_home_branch_id FOREIGN KEY (home_branch_id) REFERENCES branch(branch_id),
    CONSTRAINT ck_customer_1 CHECK (kyc_status IN ('PENDING','VERIFIED','REJECTED'))
);

-- ACCOUNT : Savings / current / salary accounts
CREATE TABLE account (
    account_id             NUMBER(10)       NOT NULL,
    account_number         CHAR(14)         NOT NULL UNIQUE,
    customer_id            NUMBER(10)       NOT NULL,
    branch_id              NUMBER(10)       NOT NULL,
    account_type           VARCHAR2(12)     NOT NULL,
    balance                NUMBER(15,2)     DEFAULT 0 NOT NULL,
    currency               CHAR(3)          DEFAULT 'INR' NOT NULL,
    status                 VARCHAR2(10)     DEFAULT 'ACTIVE' NOT NULL,
    opened_date            DATE             NOT NULL,
    interest_rate          NUMBER(5,2)      NULL,
    CONSTRAINT pk_account PRIMARY KEY (account_id),
    CONSTRAINT fk_account_customer_id FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    CONSTRAINT fk_account_branch_id FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
    CONSTRAINT ck_account_1 CHECK (account_type IN ('SAVINGS','CURRENT','SALARY','NRI')),
    CONSTRAINT ck_account_2 CHECK (status IN ('ACTIVE','DORMANT','FROZEN','CLOSED')),
    CONSTRAINT ck_account_3 CHECK (balance >= 0)
);

-- ACCOUNT_TXN : Every debit and credit posted to an account
CREATE TABLE account_txn (
    txn_id                 NUMBER(19)       NOT NULL,
    account_id             NUMBER(10)       NOT NULL,
    txn_date               TIMESTAMP        NOT NULL,
    txn_type               VARCHAR2(6)      NOT NULL,
    amount                 NUMBER(15,2)     NOT NULL,
    channel                VARCHAR2(10)     NOT NULL,
    narration              VARCHAR2(100)    NULL,
    status                 VARCHAR2(10)     DEFAULT 'SUCCESS' NOT NULL,
    reference_no           VARCHAR2(20)     NULL,
    CONSTRAINT pk_account_txn PRIMARY KEY (txn_id),
    CONSTRAINT fk_account_txn_account_id FOREIGN KEY (account_id) REFERENCES account(account_id),
    CONSTRAINT ck_account_txn_1 CHECK (txn_type IN ('DEBIT','CREDIT')),
    CONSTRAINT ck_account_txn_2 CHECK (amount > 0),
    CONSTRAINT ck_account_txn_3 CHECK (channel IN ('ATM','UPI','NEFT','RTGS','IMPS','POS','BRANCH','ONLINE'))
);

-- LOAN : Home / auto / personal / education loans
CREATE TABLE loan (
    loan_id                NUMBER(10)       NOT NULL,
    customer_id            NUMBER(10)       NOT NULL,
    branch_id              NUMBER(10)       NOT NULL,
    loan_type              VARCHAR2(15)     NOT NULL,
    principal_amount       NUMBER(15,2)     NOT NULL,
    interest_rate          NUMBER(5,2)      NOT NULL,
    tenure_months          NUMBER(10)       NOT NULL,
    emi_amount             NUMBER(15,2)     NOT NULL,
    disbursed_date         DATE             NOT NULL,
    outstanding_amount     NUMBER(15,2)     NOT NULL,
    status                 VARCHAR2(12)     DEFAULT 'ACTIVE' NOT NULL,
    CONSTRAINT pk_loan PRIMARY KEY (loan_id),
    CONSTRAINT fk_loan_customer_id FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    CONSTRAINT fk_loan_branch_id FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
    CONSTRAINT ck_loan_1 CHECK (loan_type IN ('HOME','AUTO','PERSONAL','EDUCATION','GOLD'))
);

-- LOAN_PAYMENT : EMI schedule and what was actually paid
CREATE TABLE loan_payment (
    payment_id             NUMBER(10)       NOT NULL,
    loan_id                NUMBER(10)       NOT NULL,
    due_date               DATE             NOT NULL,
    paid_date              DATE             NULL,
    amount_due             NUMBER(15,2)     NOT NULL,
    amount_paid            NUMBER(15,2)     NULL,
    status                 VARCHAR2(10)     DEFAULT 'DUE' NOT NULL,
    CONSTRAINT pk_loan_payment PRIMARY KEY (payment_id),
    CONSTRAINT fk_loan_payment_loan_id FOREIGN KEY (loan_id) REFERENCES loan(loan_id)
);

-- CARD : Debit and credit cards issued on an account
CREATE TABLE card (
    card_id                NUMBER(10)       NOT NULL,
    account_id             NUMBER(10)       NOT NULL,
    card_type              VARCHAR2(10)     NOT NULL,
    card_number_masked     CHAR(19)         NOT NULL,
    issued_date            DATE             NOT NULL,
    expiry_date            DATE             NOT NULL,
    status                 VARCHAR2(10)     DEFAULT 'ACTIVE' NOT NULL,
    daily_limit            NUMBER(15,2)     NOT NULL,
    CONSTRAINT pk_card PRIMARY KEY (card_id),
    CONSTRAINT fk_card_account_id FOREIGN KEY (account_id) REFERENCES account(account_id)
);

-- BENEFICIARY : Payees a customer has registered for transfers
CREATE TABLE beneficiary (
    beneficiary_id         NUMBER(10)       NOT NULL,
    customer_id            NUMBER(10)       NOT NULL,
    beneficiary_name       VARCHAR2(60)     NOT NULL,
    beneficiary_acct       CHAR(14)         NOT NULL,
    ifsc_code              CHAR(11)         NOT NULL,
    added_on               DATE             NOT NULL,
    is_active              CHAR(1)          DEFAULT 'Y' NOT NULL,
    CONSTRAINT pk_beneficiary PRIMARY KEY (beneficiary_id),
    CONSTRAINT fk_beneficiary_customer_id FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
);

-- EMPLOYEE : Branch staff - used for self-join and hierarchy examples
CREATE TABLE employee (
    employee_id            NUMBER(10)       NOT NULL,
    first_name             VARCHAR2(40)     NOT NULL,
    last_name              VARCHAR2(40)     NOT NULL,
    branch_id              NUMBER(10)       NOT NULL,
    designation            VARCHAR2(30)     NOT NULL,
    manager_id             NUMBER(10)       NULL,
    hire_date              DATE             NOT NULL,
    salary                 NUMBER(15,2)     NOT NULL,
    CONSTRAINT pk_employee PRIMARY KEY (employee_id),
    CONSTRAINT fk_employee_branch_id FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
    CONSTRAINT fk_employee_manager_id FOREIGN KEY (manager_id) REFERENCES employee(employee_id)
);

-- Indexes that every module's queries rely on
CREATE INDEX ix_account_customer  ON account(customer_id);
CREATE INDEX ix_txn_account_date  ON account_txn(account_id, txn_date);
CREATE INDEX ix_txn_date          ON account_txn(txn_date);
CREATE INDEX ix_loan_customer     ON loan(customer_id);
