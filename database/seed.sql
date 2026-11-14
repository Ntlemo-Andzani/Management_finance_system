-- =====================================================================
-- MFMS demo data.  Run AFTER schema.sql:
--   mysql -u root -p mfms < database/seed.sql
-- Demo passwords: Admin@123 / Manager@123 / Officer@123 / Teller@123
-- =====================================================================
USE mfms;

INSERT INTO branches (id, code, name, address, phone) VALUES
 (1,'HQ','Head Office - Pretoria','120 Church Street, Pretoria CBD','012 345 6789'),
 (2,'MAM','Mamelodi Branch','Tsamaya Road, Mamelodi','012 800 1122'),
 (3,'SOS','Soshanguve Branch','Block H, Soshanguve','012 700 3344');

INSERT INTO users (id, branch_id, full_name, email, password_hash, role, phone) VALUES
 (1,1,'System Administrator','admin@mfms.co.za','$2a$10$HxD/EZK.EyKyhnGzewx.e.bZ6ZoJY2nLW.v2JzmwFi.MCycG/lMWa','admin','082 000 0001'),
 (2,1,'Naledi Mokoena','manager@mfms.co.za','$2a$10$ZEGRsb99PwJbdAhUFoB2jOedGrFwGAAe9tl2sGJH9LzlOuWZ7HbfO','manager','082 000 0002'),
 (3,2,'Sipho Dlamini','officer@mfms.co.za','$2a$10$hTXxW8VrYBWGazkjqhGF8.RXEr1/1Adj9SxM2nXc6NWczt8UUEKES','officer','082 000 0003'),
 (4,2,'Thandi Nkosi','teller@mfms.co.za','$2a$10$K5j9VzIvLTjbdV4DnqlZneu7AoGYqXVOpo8Sd7x.laKxtZYgiV9sa','teller','082 000 0004');

INSERT INTO loan_products
 (id, code, name, interest_rate, interest_method, repayment_frequency, min_amount, max_amount,
  min_term_months, max_term_months, processing_fee_pct, penalty_rate_pct,
  insurance_rate_pct, insurance_method) VALUES
 (1,'BIZ-FLAT','Business Booster (Flat)',      24.000,'flat','monthly', 1000,  50000, 3, 24, 2.50, 5.00, 1.500,'flat'),
 (2,'BIZ-RED','Enterprise Loan (Reducing)',    18.000,'reducing','monthly', 5000, 200000, 6, 36, 2.00, 5.00, 1.200,'declining'),
 (3,'WKLY','Market Trader Weekly',             30.000,'flat','weekly',  500,  15000, 1,  6, 1.50, 8.00, 0.000,'none'),
 (4,'EMERG','Emergency Micro-Loan',            36.000,'flat','monthly',  300,   5000, 1,  6, 0.00,10.00, 2.000,'flat');

INSERT INTO clients
 (id, client_no, branch_id, officer_id, first_name, last_name, national_id, date_of_birth, gender,
  phone, email, address, occupation, business_name, monthly_income, status) VALUES
 (1,'CL-0001',2,3,'Lerato','Mahlangu','8801154567081','1988-01-15','female','073 111 2233','lerato@example.com','24 Tsamaya Rd, Mamelodi','Trader','Lerato Fresh Produce',12500.00,'active'),
 (2,'CL-0002',2,3,'Jabu','Ndlovu','9203027654082','1992-03-02','male','073 222 3344','jabu@example.com','5 Denneboom, Mamelodi','Tailor','Jabu Tailoring',8300.00,'active'),
 (3,'CL-0003',3,3,'Ayanda','Khumalo','9509128765083','1995-09-12','female','073 333 4455','ayanda@example.com','Block H, Soshanguve','Hairdresser','Ayanda Salon',9800.00,'active'),
 (4,'CL-0004',1,2,'Pieter','van Wyk','8407233456084','1984-07-23','male','073 444 5566','pieter@example.com','Sunnyside, Pretoria','Mechanic','PW Auto Repairs',21000.00,'active'),
 (5,'CL-0005',2,3,'Nomsa','Sithole','9911056543085','1999-11-05','female','073 555 6677',NULL,'Mamelodi East','Street vendor',NULL,4200.00,'pending');

INSERT INTO client_groups (id, branch_id, name, meeting_day) VALUES
 (1,2,'Mamelodi Traders Circle','Tue'),
 (2,3,'Soshanguve Women in Business','Thu');

INSERT INTO group_members (group_id, client_id) VALUES (1,1),(1,2),(2,3);

INSERT INTO savings_accounts (id, account_no, client_id, interest_rate, balance) VALUES
 (1,'SA-0001',1,4.50,3200.00),
 (2,'SA-0002',2,4.50,1150.00),
 (3,'SA-0003',3,4.50,780.00);

INSERT INTO savings_transactions (account_id, type, amount, balance_after, txn_date, performed_by, reference) VALUES
 (1,'deposit',2000.00,2000.00,'2026-05-04',4,'Opening deposit'),
 (1,'deposit',1500.00,3500.00,'2026-06-04',4,'Monthly saving'),
 (1,'withdrawal',300.00,3200.00,'2026-07-02',4,'Stock purchase'),
 (2,'deposit',1150.00,1150.00,'2026-06-10',4,'Opening deposit'),
 (3,'deposit',780.00,780.00,'2026-07-01',4,'Opening deposit');

-- Loans are created through the application so that schedules are generated
-- by the LoanService. This single pending application seeds the approval queue.
INSERT INTO loans
 (id, loan_no, client_id, product_id, officer_id, branch_id, principal, interest_rate,
  interest_method, repayment_frequency, term_months, purpose, application_date, status)
VALUES
 (1,'LN-000001',2,1,3,2,10000.00,24.000,'flat','monthly',12,'Purchase of industrial sewing machine','2026-08-01','pending');

-- Nominated beneficiaries. Shares per client must total 100%.
INSERT INTO beneficiaries
 (client_id, full_name, relationship, national_id, phone, share_pct) VALUES
 (1,'Thabo Mahlangu','spouse','8605121234081','073 111 9900',60.00),
 (1,'Karabo Mahlangu','child','1203145678082','073 111 9901',40.00),
 (2,'Nosipho Ndlovu','spouse','9401023456083','073 222 8800',100.00),
 (3,'Grace Khumalo','parent','6708114567084','073 333 7700',100.00),
 (4,'Marie van Wyk','spouse','8609304567085','073 444 6600',100.00);
