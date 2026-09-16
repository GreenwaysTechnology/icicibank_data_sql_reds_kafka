-- =====================================================================
--  ICCI BANK  |  Module 2 deliverable: Smart Saver fixed deposits
--  20 pilot bookings. Load AFTER creating the fixed_deposit table.
--  Used again in Modules 3, 5, 6 and 12.
-- =====================================================================
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7001, 1001, 1, 'FD2026000001', 25000.00, 6.75, 90, DATE '2026-03-01', DATE '2026-05-30', 'N', 'Priya Verma', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7002, 1002, 2, 'FD2026000002', 50000.00, 6.90, 180, DATE '2026-03-02', DATE '2026-08-29', 'Y', 'Rahul Sharma', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7003, 1003, 3, 'FD2026000003', 100000.00, 7.25, 365, DATE '2026-03-03', DATE '2027-03-03', 'Y', NULL, 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7004, 1004, 4, 'FD2026000004', 150000.00, 7.40, 730, DATE '2026-03-04', DATE '2028-03-03', 'N', 'Suresh Iyer', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7005, 1005, 5, 'FD2026000005', 250000.00, 7.85, 1095, DATE '2026-03-05', DATE '2029-03-04', 'Y', 'Priya Verma', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7006, 1006, 6, 'FD2026000006', 500000.00, 7.75, 1825, DATE '2026-03-06', DATE '2031-03-05', 'Y', NULL, 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7007, 1007, 7, 'FD2026000007', 750000.00, 6.50, 90, DATE '2026-03-07', DATE '2026-06-05', 'N', 'Anita Nair', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7008, 1008, 8, 'FD2026000008', 1000000.00, 6.90, 180, DATE '2026-03-08', DATE '2026-09-04', 'Y', 'Suresh Iyer', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7009, 1010, 1, 'FD2026000009', 1500000.00, 7.50, 365, DATE '2026-03-09', DATE '2027-03-09', 'Y', NULL, 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7010, 1012, 2, 'FD2026000010', 2500000.00, 7.40, 730, DATE '2026-03-10', DATE '2028-03-09', 'N', 'Rahul Sharma', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7011, 1014, 3, 'FD2026000011', 25000.00, 7.60, 1095, DATE '2026-03-11', DATE '2029-03-10', 'Y', 'Anita Nair', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7012, 1015, 4, 'FD2026000012', 50000.00, 7.75, 1825, DATE '2026-03-12', DATE '2031-03-11', 'Y', NULL, 'BROKEN');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7013, 1018, 5, 'FD2026000013', 100000.00, 6.75, 90, DATE '2026-03-13', DATE '2026-06-11', 'N', 'Priya Verma', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7014, 1020, 6, 'FD2026000014', 150000.00, 6.90, 180, DATE '2026-03-14', DATE '2026-09-10', 'Y', 'Rahul Sharma', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7015, 1021, 7, 'FD2026000015', 250000.00, 7.25, 365, DATE '2026-03-15', DATE '2027-03-15', 'Y', NULL, 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7016, 1023, 8, 'FD2026000016', 500000.00, 7.40, 730, DATE '2026-03-16', DATE '2028-03-15', 'N', 'Suresh Iyer', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7017, 1025, 1, 'FD2026000017', 750000.00, 7.85, 1095, DATE '2026-03-17', DATE '2029-03-16', 'Y', 'Priya Verma', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7018, 1026, 2, 'FD2026000018', 1000000.00, 7.75, 1825, DATE '2026-03-18', DATE '2031-03-17', 'Y', NULL, 'MATURED');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7019, 1028, 3, 'FD2026000019', 1500000.00, 6.50, 90, DATE '2026-03-19', DATE '2026-06-17', 'N', 'Anita Nair', 'ACTIVE');
INSERT INTO fixed_deposit (deposit_id, customer_id, branch_id, receipt_number, principal_amount, interest_rate, tenure_days, booked_date, maturity_date, auto_renew, nominee_name, status) VALUES
  (7020, 1030, 4, 'FD2026000020', 2500000.00, 6.90, 180, DATE '2026-03-20', DATE '2026-09-16', 'Y', 'Suresh Iyer', 'ACTIVE');
