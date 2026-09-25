-- ---------------------------------------------------------------------------
-- Horizon Bank (training app) - seed data
--   6 customers, 8 accounts, ~470 transactions spread over the last 120 days.
--   Customer 1 (Arjun Mehta) is the "logged-in" user of the dashboard and
--   owns three accounts; everyone else is a transfer beneficiary.
-- All names, numbers and amounts are synthetic training data.
-- setseed() makes random() repeatable, so every fresh container gets the
-- same amounts and descriptions (dates are relative to the day you start it).
-- ---------------------------------------------------------------------------

INSERT INTO customers (full_name, email, mobile, city) VALUES
 ('Arjun Mehta',   'arjun.mehta@example.com',   '+91 98200 11223', 'Mumbai'),
 ('Priya Sharma',  'priya.sharma@example.com',  '+91 98110 44556', 'New Delhi'),
 ('Rahul Verma',   'rahul.verma@example.com',   '+91 99870 77889', 'Pune'),
 ('Sneha Iyer',    'sneha.iyer@example.com',    '+91 94440 22113', 'Chennai'),
 ('Vikram Rao',    'vikram.rao@example.com',    '+91 98450 66778', 'Bengaluru'),
 ('Ananya Gupta',  'ananya.gupta@example.com',  '+91 98300 99001', 'Kolkata');

INSERT INTO accounts (account_no, customer_id, account_type, branch, ifsc, opened_on) VALUES
 ('602501000101', 1, 'SAVINGS', 'Andheri West, Mumbai',   'HRZN0000123', '2016-04-12'),
 ('602501000102', 1, 'SALARY',  'Bandra Kurla, Mumbai',   'HRZN0000145', '2019-07-01'),
 ('602501000103', 1, 'CURRENT', 'Fort, Mumbai',           'HRZN0000101', '2021-02-15'),
 ('602501000201', 2, 'SAVINGS', 'Connaught Place, Delhi', 'HRZN0000301', '2017-09-20'),
 ('602501000301', 3, 'SAVINGS', 'Koregaon Park, Pune',    'HRZN0000411', '2018-03-05'),
 ('602501000401', 4, 'SAVINGS', 'T Nagar, Chennai',       'HRZN0000522', '2015-11-30'),
 ('602501000501', 5, 'CURRENT', 'MG Road, Bengaluru',     'HRZN0000633', '2020-06-18'),
 ('602501000601', 6, 'SAVINGS', 'Park Street, Kolkata',   'HRZN0000744', '2022-01-10');

DO $$
DECLARE
    acc        RECORD;
    i          INT;
    n          INT;
    is_credit  BOOLEAN;
    amt        NUMERIC(14,2);
    ch         TEXT;
    descr      TEXT;
    ts         TIMESTAMPTZ;
    debit_desc TEXT[] := ARRAY[
        'UPI/Swiggy/Food order', 'UPI/Zomato/Dinner', 'POS/Amazon.in/Shopping',
        'UPI/BigBasket/Groceries', 'BillPay/Electricity - MSEDCL', 'ATM WDL/Andheri West',
        'UPI/Uber India/Ride', 'BillPay/Airtel Postpaid', 'POS/Shell/Fuel',
        'UPI/Apollo Pharmacy', 'NACH/Mutual Fund SIP', 'UPI/IRCTC/Train tickets',
        'POS/DMart/Household', 'BillPay/Mahanagar Gas', 'UPI/BookMyShow/Movies'];
    debit_ch   TEXT[] := ARRAY[
        'UPI', 'UPI', 'POS', 'UPI', 'NEFT', 'ATM', 'UPI', 'NEFT', 'POS',
        'UPI', 'NACH', 'UPI', 'POS', 'NEFT', 'UPI'];
    credit_desc TEXT[] := ARRAY[
        'UPI/Received from friend', 'IMPS/Refund - Amazon.in', 'NEFT/Client payment',
        'UPI/Cashback credit', 'IMPS/Received'];
    credit_ch  TEXT[] := ARRAY['UPI', 'IMPS', 'NEFT', 'UPI', 'IMPS'];
    k          INT;
BEGIN
    PERFORM setseed(0.42);

    FOR acc IN SELECT account_no, account_type FROM accounts ORDER BY account_no LOOP
        -- opening balance 121 days ago
        INSERT INTO transactions (account_no, txn_type, amount, channel, description,
                                  reference_no, created_at)
        VALUES (acc.account_no, 'CREDIT',
                CASE acc.account_type WHEN 'CURRENT' THEN 450000 ELSE 180000 END,
                'NEFT', 'Opening balance brought forward',
                'OPN' || right(acc.account_no, 6),
                date_trunc('day', now()) - INTERVAL '121 days' + INTERVAL '9 hours');

        n := CASE WHEN acc.account_no = '602501000101' THEN 90 ELSE 55 END;
        FOR i IN 1..n LOOP
            ts := date_trunc('day', now()) - INTERVAL '120 days'
                  + (i::NUMERIC / n) * INTERVAL '119 days'
                  + (floor(random() * 12) + 8) * INTERVAL '1 hour'
                  + floor(random() * 60) * INTERVAL '1 minute';
            is_credit := random() < 0.18;
            IF is_credit THEN
                k := 1 + floor(random() * array_length(credit_desc, 1))::INT;
                amt := round((500 + random() * 14500)::NUMERIC, 2);
                descr := credit_desc[k];  ch := credit_ch[k];
            ELSE
                k := 1 + floor(random() * array_length(debit_desc, 1))::INT;
                amt := round((120 + random() * 4880)::NUMERIC, 2);
                descr := debit_desc[k];   ch := debit_ch[k];
                IF ch = 'ATM' THEN amt := (1 + floor(random() * 10)) * 500; END IF;
            END IF;
            INSERT INTO transactions (account_no, txn_type, amount, channel, description,
                                      reference_no, created_at)
            VALUES (acc.account_no, CASE WHEN is_credit THEN 'CREDIT' ELSE 'DEBIT' END,
                    amt, ch, descr,
                    ch || to_char(ts, 'YYMMDD') || lpad((floor(random() * 1000000))::TEXT, 6, '0'),
                    ts);
        END LOOP;

        -- monthly salary / interest so the statements look like a real bank's
        FOR i IN 0..3 LOOP
            ts := date_trunc('month', now()) - (i * INTERVAL '1 month') + INTERVAL '10 hours';
            CONTINUE WHEN ts > now();
            IF acc.account_type = 'SALARY' THEN
                INSERT INTO transactions (account_no, txn_type, amount, channel, description,
                                          reference_no, created_at)
                VALUES (acc.account_no, 'CREDIT', 185000, 'NEFT',
                        'NEFT/Salary credit - Acme Technologies Pvt Ltd',
                        'SAL' || to_char(ts, 'YYYYMM') || right(acc.account_no, 4), ts);
            ELSIF acc.account_type = 'SAVINGS' THEN
                INSERT INTO transactions (account_no, txn_type, amount, channel, description,
                                          reference_no, created_at)
                VALUES (acc.account_no, 'CREDIT', round((300 + random() * 600)::NUMERIC, 2),
                        'INT', 'Savings interest credit',
                        'INT' || to_char(ts, 'YYYYMM') || right(acc.account_no, 4), ts);
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- running balance after each transaction, then the account's current balance
UPDATE transactions t
SET    balance_after = r.running
FROM  (SELECT txn_id,
              SUM(CASE WHEN txn_type = 'CREDIT' THEN amount ELSE -amount END)
                  OVER (PARTITION BY account_no ORDER BY created_at, txn_id) AS running
       FROM transactions) r
WHERE  r.txn_id = t.txn_id;

UPDATE accounts a
SET    balance = s.bal
FROM  (SELECT account_no,
              SUM(CASE WHEN txn_type = 'CREDIT' THEN amount ELSE -amount END) AS bal
       FROM transactions GROUP BY account_no) s
WHERE  s.account_no = a.account_no;
