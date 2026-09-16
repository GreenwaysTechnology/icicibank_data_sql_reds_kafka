-- =====================================================================
--  ICICI BANK  |  Module 4  |  BRANCH_CUSTOMER_FLAT
--  The un-normalised 'customer master' loaded straight from the branch
--  spreadsheet. This table is DELIBERATELY BADLY DESIGNED: repeating
--  groups (acct_no_1/acct_no_2), a multi-valued column (products), and
--  branch details repeated on every customer row - with four different
--  spellings of one branch name, which is audit finding ICICI-4577.
--  All data is synthetic, generated for training.
-- =====================================================================
DROP TABLE IF EXISTS branch_customer_flat;
CREATE TABLE branch_customer_flat (
    cust_id      INTEGER,
    cust_name    VARCHAR(80),
    cust_phone   VARCHAR(15),
    cust_city    VARCHAR(40),
    branch_code  VARCHAR(6),
    branch_name  VARCHAR(60),
    branch_ifsc  CHAR(11),
    branch_city  VARCHAR(40),
    acct_no_1    VARCHAR(14),
    acct_type_1  VARCHAR(12),
    balance_1    NUMERIC(15,2),
    acct_no_2    VARCHAR(14),
    acct_type_2  VARCHAR(12),
    balance_2    NUMERIC(15,2),
    products     VARCHAR(40)
);

INSERT INTO branch_customer_flat VALUES (1001,'Aarav Sharma','9810000000','Mumbai','BR01','Fort Mumbai Main','ICIC0000101','Mumbai','ICIC0000009001','CURRENT',35859.46,NULL,NULL,NULL,'FD,LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1002,'Diya Nair','9810000137','Bengaluru','BR02','Andheri East','ICIC0000102','Mumbai','ICIC0000009002','SALARY',43522.54,NULL,NULL,NULL,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1003,'Rohan Iyer','9810000274','Chennai','BR03','Koramangala','ICIC0000203','Bengaluru','ICIC0000009003','SAVINGS',341244.80,NULL,NULL,NULL,'FD,LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1004,'Meera Reddy','9810000411','Hyderabad','BR04','Whitefield','ICIC0000204','Bengaluru','ICIC0000009004','SAVINGS',421425.91,NULL,NULL,NULL,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1005,'Karthik Gupta','9810000548','Pune','BR05','T Nagar Chennai','ICIC0000305','Chennai','ICIC0000009005','CURRENT',91729.06,'ICIC0000009006','SALARY',27637.82,'FD,LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1006,'Ananya Menon','9810000685','Delhi','BR06','Banjara Hills','ICIC0000406','Hyderabad','ICIC0000009007','SALARY',390474.85,NULL,NULL,NULL,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1007,'Vikram Patel','9810000822','Kochi','BR07','Baner Pune','ICIC0000507','Pune','ICIC0000009008','SAVINGS',74946.54,NULL,NULL,NULL,'FD,LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1008,'Sneha Rao','9810000959','Kolkata','BR08','Connaught Place','ICIC0000608','Delhi','ICIC0000009009','SAVINGS',405554.09,NULL,NULL,NULL,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1009,'Arjun Singh','9810001096','Mumbai','BR01','Fort Mumbai Main','ICIC0000101','Mumbai','ICIC0000009010','CURRENT',49313.33,NULL,NULL,NULL,'LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1010,'Priya Verma','9810001233','Bengaluru','BR02','Andheri East','ICIC0000102','Mumbai','ICIC0000009011','SALARY',163382.12,'ICIC0000009012','SAVINGS',289623.28,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1011,'Rahul Khan','9810001370','Chennai','BR03','Koramangla','ICIC0000203','Bengaluru','ICIC0000009013','SAVINGS',410879.83,NULL,NULL,NULL,'LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1012,'Kavya Das','9810001507','Hyderabad','BR04','Whitefield','ICIC0000204','Bengaluru','ICIC0000009014','SAVINGS',13314.15,NULL,NULL,NULL,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1013,'Sanjay Joseph','9810001644','Pune','BR05','T Nagar Chennai','ICIC0000305','Chennai','ICIC0000009015','CURRENT',276393.25,NULL,NULL,NULL,'LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1014,'Nisha Pillai','9810001781','Delhi','BR06','Banjara Hills','ICIC0000406','Hyderabad','ICIC0000009016','SALARY',32490.08,NULL,NULL,NULL,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1015,'Imran Bose','9810001918','Kochi','BR07','Baner Pune','ICIC0000507','Pune','ICIC0000009017','SAVINGS',95582.81,'ICIC0000009018','SAVINGS',91521.58,'FD,LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1016,'Fatima Kulkarni','9810002055','Kolkata','BR08','Connaught Place','ICIC0000608','Delhi','ICIC0000009019','SAVINGS',473345.84,NULL,NULL,NULL,'CARD');
INSERT INTO branch_customer_flat VALUES (1017,'Joseph Shetty','9810002192','Mumbai','BR01','Fort Mumbai Main','ICIC0000101','Mumbai','ICIC0000009020','CURRENT',408783.99,NULL,NULL,NULL,'LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1018,'Grace Mehta','9810002329','Bengaluru','BR02','Andheri East','ICIC0000102','Mumbai','ICIC0000009021','SALARY',439665.56,NULL,NULL,NULL,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1019,'Manish Chopra','9810002466','Chennai','BR03','Kormangala','ICIC0000203','Bengaluru','ICIC0000009022','SAVINGS',71007.07,NULL,NULL,NULL,'LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1020,'Ritu Banerjee','9810002603','Hyderabad','BR04','Whitefield','ICIC0000204','Bengaluru','ICIC0000009023','SAVINGS',263724.55,'ICIC0000009024','CURRENT',390512.75,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1021,'Deepak Sharma','9810002740','Pune','BR05','T Nagar Chennai','ICIC0000305','Chennai','ICIC0000009025','CURRENT',238967.39,NULL,NULL,NULL,'FD,LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1022,'Swati Nair','9810002877','Delhi','BR06','Banjara Hills','ICIC0000406','Hyderabad','ICIC0000009026','SALARY',291583.50,NULL,NULL,NULL,'CARD');
INSERT INTO branch_customer_flat VALUES (1023,'Naveen Iyer','9810003014','Kochi','BR07','Baner Pune','ICIC0000507','Pune','ICIC0000009027','SAVINGS',119212.62,NULL,NULL,NULL,'FD,LOAN,CARD');
INSERT INTO branch_customer_flat VALUES (1024,'Lakshmi Reddy','9810003151','Kolkata','BR08','Connaught Place','ICIC0000608','Delhi','ICIC0000009028','SAVINGS',200495.72,NULL,NULL,NULL,'CARD');
INSERT INTO branch_customer_flat VALUES (1025,'Farhan Gupta','9810003288','Mumbai','BR01','Fort Mumbai Main','ICIC0000101','Mumbai','ICIC0000009029','CURRENT',274406.29,'ICIC0000009030','SALARY',163114.34,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1026,'Tara Menon','9810003425','Bengaluru','BR02','Andheri East','ICIC0000102','Mumbai','ICIC0000009031','SALARY',238993.20,NULL,NULL,NULL,'FD,CARD');
INSERT INTO branch_customer_flat VALUES (1027,'Gaurav Patel','9810003562','Chennai','BR03','Koramangala ','ICIC0000203','Bengaluru','ICIC0000009032','SAVINGS',138102.26,NULL,NULL,NULL,'CARD');
INSERT INTO branch_customer_flat VALUES (1028,'Pooja Rao','9810003699','Hyderabad','BR04','Whitefield','ICIC0000204','Bengaluru','ICIC0000009033','SAVINGS',148111.48,NULL,NULL,NULL,'FD');
INSERT INTO branch_customer_flat VALUES (1029,'Suresh Singh','9810003836','Pune','BR05','T Nagar Chennai','ICIC0000305','Chennai','ICIC0000009034','CURRENT',230818.92,NULL,NULL,NULL,'NONE');
INSERT INTO branch_customer_flat VALUES (1030,'Anjali Verma','9810003973','Delhi','BR06','Banjara Hills','ICIC0000406','Hyderabad','ICIC0000009035','SALARY',400457.72,'ICIC0000009036','SAVINGS',187205.83,'FD');
