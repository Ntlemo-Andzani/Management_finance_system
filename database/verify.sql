-- =====================================================================
-- MFMS — installation check
--
-- Run this AFTER schema.sql and seed.sql to confirm the database is correct.
--   Windows (PowerShell):  cmd /c "mysql -u root -p < database\verify.sql"
--   Mac / Linux / Git Bash: mysql -u root -p < database/verify.sql
--
-- Every line of the output should read OK. Anything reading PROBLEM means
-- one of the two setup scripts did not finish — re-run them in order.
-- =====================================================================
USE mfms;

SELECT '--- MFMS installation check ---' AS ``;

SELECT
  CONCAT(
    CASE WHEN COUNT(*) = 18 THEN 'OK      ' ELSE 'PROBLEM ' END,
    'Tables: ', COUNT(*), ' of 18 expected'
  ) AS ``
FROM information_schema.tables
WHERE table_schema = 'mfms' AND table_type = 'BASE TABLE';

SELECT
  CONCAT(
    CASE WHEN COUNT(*) = 3 THEN 'OK      ' ELSE 'PROBLEM ' END,
    'Reporting views: ', COUNT(*), ' of 3 expected'
  ) AS ``
FROM information_schema.views
WHERE table_schema = 'mfms';

SELECT
  CONCAT(
    CASE WHEN COUNT(*) = 4 THEN 'OK      ' ELSE 'PROBLEM ' END,
    'Staff accounts: ', COUNT(*), ' of 4 expected'
  ) AS ``
FROM users;

SELECT
  CONCAT(
    CASE WHEN COUNT(*) = 5 THEN 'OK      ' ELSE 'PROBLEM ' END,
    'Clients: ', COUNT(*), ' of 5 expected'
  ) AS ``
FROM clients;

SELECT
  CONCAT(
    CASE WHEN COUNT(*) = 4 THEN 'OK      ' ELSE 'PROBLEM ' END,
    'Loan products: ', COUNT(*), ' of 4 expected'
  ) AS ``
FROM loan_products;

SELECT
  CONCAT(
    CASE WHEN COUNT(*) = 3 THEN 'OK      ' ELSE 'PROBLEM ' END,
    'Savings accounts: ', COUNT(*), ' of 3 expected'
  ) AS ``
FROM savings_accounts;

SELECT
  CONCAT(
    CASE WHEN COUNT(*) >= 1 THEN 'OK      ' ELSE 'PROBLEM ' END,
    'Pending loan application: ', COUNT(*), ' (needed for the approval demo)'
  ) AS ``
FROM loans WHERE status = 'pending';

-- Foreign keys are what make the joins in the reports work.
SELECT
  CONCAT(
    CASE WHEN COUNT(*) >= 20 THEN 'OK      ' ELSE 'PROBLEM ' END,
    'Foreign keys: ', COUNT(*), ' (20 or more expected)'
  ) AS ``
FROM information_schema.referential_constraints
WHERE constraint_schema = 'mfms';

SELECT
  CONCAT(
    CASE WHEN COUNT(*) = 5 THEN 'OK      ' ELSE 'PROBLEM ' END,
    'Nominated beneficiaries: ', COUNT(*), ' of 5 expected'
  ) AS ``
FROM beneficiaries;

SELECT
  CONCAT(
    CASE WHEN COUNT(*) = 3 THEN 'OK      ' ELSE 'PROBLEM ' END,
    'Insured loan products: ', COUNT(*), " of 3 expected"
  ) AS ``
FROM loan_products WHERE insurance_method <> 'none';

SELECT '--- Sign in with these accounts ---' AS ``;

SELECT
  CONCAT(RPAD(email, 24, ' '), ' ', RPAD(role, 9, ' '), ' ', branch_id) AS `email / role / branch`
FROM users ORDER BY id;

SELECT '--- If every line above says OK, start the server: cd server && npm start ---' AS ``;
