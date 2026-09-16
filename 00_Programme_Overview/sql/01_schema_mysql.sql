-- =====================================================================
--  ICICI BANK  |  Core Banking Schema  |  MYSQL
--  Enterprise Data Engineering with SQL, Redis & Kafka
--  Run this ONCE before Module 2. Every module builds on these tables.
-- =====================================================================

DROP TABLE IF EXISTS employee;
DROP TABLE IF EXISTS beneficiary;
DROP TABLE IF EXISTS card;
DROP TABLE IF EXISTS loan_payment;
DROP TABLE IF EXISTS loan;
DROP TABLE IF EXISTS account_txn;
DROP TABLE IF EXISTS account;
DROP TABLE IF EXISTS customer;
DROP TABLE IF EXISTS branch;

-- BRANCH : Physical ICICI Bank branches
CREATE TABLE branch (
    branch_id              INT              NOT NULL,
    branch_name            VARCHAR(60)      NOT NULL,
    ifsc_code              CHAR(11)         NOT NULL UNIQUE,
    city                   VARCHAR(40)      NOT NULL,
    state                  VARCHAR(40)      NOT NULL,
    opened_date            DATE             NOT NULL,
    CONSTRAINT pk_branch PRIMARY KEY (branch_id)
);

-- CUSTOMER : Every individual who banks with ICICI Bank
CREATE TABLE customer (
    customer_id            INT              NOT NULL,
    first_name             VARCHAR(40)      NOT NULL,
    last_name              VARCHAR(40)      NOT NULL,
    date_of_birth          DATE             NOT NULL,
    email                  VARCHAR(80)      NULL UNIQUE,
    phone                  VARCHAR(15)      NOT NULL,
    city                   VARCHAR(40)      NULL,
    kyc_status             VARCHAR(12)      DEFAULT 'PENDING' NOT NULL,
    risk_rating            VARCHAR(10)      NULL,
    customer_since         DATE             NOT NULL,
    home_branch_id         INT              NOT NULL,
    CONSTRAINT pk_customer PRIMARY KEY (customer_id),
    CONSTRAINT fk_customer_home_branch_id FOREIGN KEY (home_branch_id) REFERENCES branch(branch_id),
    CONSTRAINT ck_customer_1 CHECK (kyc_status IN ('PENDING','VERIFIED','REJECTED'))
);

-- ACCOUNT : Savings / current / salary accounts
CREATE TABLE account (
    account_id             INT              NOT NULL,
    account_number         CHAR(14)         NOT NULL UNIQUE,
    customer_id            INT              NOT NULL,
    branch_id              INT              NOT NULL,
    account_type           VARCHAR(12)      NOT NULL,
    balance                DECIMAL(15,2)    DEFAULT 0 NOT NULL,
    currency               CHAR(3)          DEFAULT 'INR' NOT NULL,
    status                 VARCHAR(10)      DEFAULT 'ACTIVE' NOT NULL,
    opened_date            DATE             NOT NULL,
    interest_rate          DECIMAL(5,2)     NULL,
    CONSTRAINT pk_account PRIMARY KEY (account_id),
    CONSTRAINT fk_account_customer_id FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    CONSTRAINT fk_account_branch_id FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
    CONSTRAINT ck_account_1 CHECK (account_type IN ('SAVINGS','CURRENT','SALARY','NRI')),
    CONSTRAINT ck_account_2 CHECK (status IN ('ACTIVE','DORMANT','FROZEN','CLOSED')),
    CONSTRAINT ck_account_3 CHECK (balance >= 0)
);

-- ACCOUNT_TXN : Every debit and credit posted to an account
CREATE TABLE account_txn (
    txn_id                 BIGINT           NOT NULL,
    account_id             INT              NOT NULL,
    txn_date               DATETIME         NOT NULL,
    txn_type               VARCHAR(6)       NOT NULL,
    amount                 DECIMAL(15,2)    NOT NULL,
    channel                VARCHAR(10)      NOT NULL,
    narration              VARCHAR(100)     NULL,
    status                 VARCHAR(10)      DEFAULT 'SUCCESS' NOT NULL,
    reference_no           VARCHAR(20)      NULL,
    CONSTRAINT pk_account_txn PRIMARY KEY (txn_id),
    CONSTRAINT fk_account_txn_account_id FOREIGN KEY (account_id) REFERENCES account(account_id),
    CONSTRAINT ck_account_txn_1 CHECK (txn_type IN ('DEBIT','CREDIT')),
    CONSTRAINT ck_account_txn_2 CHECK (amount > 0),
    CONSTRAINT ck_account_txn_3 CHECK (channel IN ('ATM','UPI','NEFT','RTGS','IMPS','POS','BRANCH','ONLINE'))
);

-- LOAN : Home / auto / personal / education loans
CREATE TABLE loan (
    loan_id                INT              NOT NULL,
    customer_id            INT              NOT NULL,
    branch_id              INT              NOT NULL,
    loan_type              VARCHAR(15)      NOT NULL,
    principal_amount       DECIMAL(15,2)    NOT NULL,
    interest_rate          DECIMAL(5,2)     NOT NULL,
    tenure_months          INT              NOT NULL,
    emi_amount             DECIMAL(15,2)    NOT NULL,
    disbursed_date         DATE             NOT NULL,
    outstanding_amount     DECIMAL(15,2)    NOT NULL,
    status                 VARCHAR(12)      DEFAULT 'ACTIVE' NOT NULL,
    CONSTRAINT pk_loan PRIMARY KEY (loan_id),
    CONSTRAINT fk_loan_customer_id FOREIGN KEY (customer_id) REFERENCES customer(customer_id),
    CONSTRAINT fk_loan_branch_id FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
    CONSTRAINT ck_loan_1 CHECK (loan_type IN ('HOME','AUTO','PERSONAL','EDUCATION','GOLD'))
);

-- LOAN_PAYMENT : EMI schedule and what was actually paid
CREATE TABLE loan_payment (
    payment_id             INT              NOT NULL,
    loan_id                INT              NOT NULL,
    due_date               DATE             NOT NULL,
    paid_date              DATE             NULL,
    amount_due             DECIMAL(15,2)    NOT NULL,
    amount_paid            DECIMAL(15,2)    NULL,
    status                 VARCHAR(10)      DEFAULT 'DUE' NOT NULL,
    CONSTRAINT pk_loan_payment PRIMARY KEY (payment_id),
    CONSTRAINT fk_loan_payment_loan_id FOREIGN KEY (loan_id) REFERENCES loan(loan_id)
);

-- CARD : Debit and credit cards issued on an account
CREATE TABLE card (
    card_id                INT              NOT NULL,
    account_id             INT              NOT NULL,
    card_type              VARCHAR(10)      NOT NULL,
    card_number_masked     CHAR(19)         NOT NULL,
    issued_date            DATE             NOT NULL,
    expiry_date            DATE             NOT NULL,
    status                 VARCHAR(10)      DEFAULT 'ACTIVE' NOT NULL,
    daily_limit            DECIMAL(15,2)    NOT NULL,
    CONSTRAINT pk_card PRIMARY KEY (card_id),
    CONSTRAINT fk_card_account_id FOREIGN KEY (account_id) REFERENCES account(account_id)
);

-- BENEFICIARY : Payees a customer has registered for transfers
CREATE TABLE beneficiary (
    beneficiary_id         INT              NOT NULL,
    customer_id            INT              NOT NULL,
    beneficiary_name       VARCHAR(60)      NOT NULL,
    beneficiary_acct       CHAR(14)         NOT NULL,
    ifsc_code              CHAR(11)         NOT NULL,
    added_on               DATE             NOT NULL,
    is_active              CHAR(1)          DEFAULT 'Y' NOT NULL,
    CONSTRAINT pk_beneficiary PRIMARY KEY (beneficiary_id),
    CONSTRAINT fk_beneficiary_customer_id FOREIGN KEY (customer_id) REFERENCES customer(customer_id)
);

-- EMPLOYEE : Branch staff - used for self-join and hierarchy examples
CREATE TABLE employee (
    employee_id            INT              NOT NULL,
    first_name             VARCHAR(40)      NOT NULL,
    last_name              VARCHAR(40)      NOT NULL,
    branch_id              INT              NOT NULL,
    designation            VARCHAR(30)      NOT NULL,
    manager_id             INT              NULL,
    hire_date              DATE             NOT NULL,
    salary                 DECIMAL(15,2)    NOT NULL,
    CONSTRAINT pk_employee PRIMARY KEY (employee_id),
    CONSTRAINT fk_employee_branch_id FOREIGN KEY (branch_id) REFERENCES branch(branch_id),
    CONSTRAINT fk_employee_manager_id FOREIGN KEY (manager_id) REFERENCES employee(employee_id)
);

-- Indexes that every module's queries rely on
CREATE INDEX ix_account_customer  ON account(customer_id);
CREATE INDEX ix_txn_account_date  ON account_txn(account_id, txn_date);
CREATE INDEX ix_txn_date          ON account_txn(txn_date);
CREATE INDEX ix_loan_customer     ON loan(customer_id);
