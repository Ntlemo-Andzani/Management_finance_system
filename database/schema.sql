-- =====================================================================
-- Microfinance Management System (MFMS)
-- File: schema.sql   Engine: MySQL 8.0+
-- Run with:  mysql -u root -p < database/schema.sql
-- =====================================================================

DROP DATABASE IF EXISTS mfms;
CREATE DATABASE mfms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mfms;

-- ---------------------------------------------------------------------
-- 1. Organisation
-- ---------------------------------------------------------------------
CREATE TABLE branches (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  code        VARCHAR(10)  NOT NULL UNIQUE,
  name        VARCHAR(120) NOT NULL,
  address     VARCHAR(255),
  phone       VARCHAR(30),
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  branch_id     INT NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','manager','officer','teller') NOT NULL DEFAULT 'officer',
  phone         VARCHAR(30),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at DATETIME NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2. Clients and solidarity groups
-- ---------------------------------------------------------------------
CREATE TABLE clients (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  client_no      VARCHAR(20)  NOT NULL UNIQUE,
  branch_id      INT NOT NULL,
  officer_id     INT NULL,
  first_name     VARCHAR(60)  NOT NULL,
  last_name      VARCHAR(60)  NOT NULL,
  national_id    VARCHAR(30)  NOT NULL UNIQUE,
  date_of_birth  DATE,
  gender         ENUM('male','female','other'),
  phone          VARCHAR(30)  NOT NULL,
  email          VARCHAR(120),
  address        VARCHAR(255),
  occupation     VARCHAR(120),
  business_name  VARCHAR(120),
  monthly_income DECIMAL(12,2) DEFAULT 0,
  status         ENUM('pending','active','inactive','blacklisted') NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_client_branch  FOREIGN KEY (branch_id)  REFERENCES branches(id),
  CONSTRAINT fk_client_officer FOREIGN KEY (officer_id) REFERENCES users(id),
  INDEX idx_client_name (last_name, first_name),
  INDEX idx_client_status (status)
) ENGINE=InnoDB;

CREATE TABLE client_groups (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  branch_id   INT NOT NULL,
  name        VARCHAR(120) NOT NULL,
  meeting_day ENUM('Mon','Tue','Wed','Thu','Fri','Sat') DEFAULT 'Mon',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_group_branch FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB;

CREATE TABLE group_members (
  group_id  INT NOT NULL,
  client_id INT NOT NULL,
  joined_at DATE NOT NULL DEFAULT (CURRENT_DATE),
  PRIMARY KEY (group_id, client_id),
  CONSTRAINT fk_gm_group  FOREIGN KEY (group_id)  REFERENCES client_groups(id) ON DELETE CASCADE,
  CONSTRAINT fk_gm_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3. Loan products and loans
-- ---------------------------------------------------------------------
CREATE TABLE loan_products (
  id                   INT AUTO_INCREMENT PRIMARY KEY,
  code                 VARCHAR(15)  NOT NULL UNIQUE,
  name                 VARCHAR(120) NOT NULL,
  interest_rate        DECIMAL(6,3) NOT NULL COMMENT 'Nominal annual rate %',
  interest_method      ENUM('flat','reducing') NOT NULL DEFAULT 'flat',
  repayment_frequency  ENUM('weekly','biweekly','monthly') NOT NULL DEFAULT 'monthly',
  min_amount           DECIMAL(12,2) NOT NULL,
  max_amount           DECIMAL(12,2) NOT NULL,
  min_term_months      INT NOT NULL DEFAULT 1,
  max_term_months      INT NOT NULL DEFAULT 24,
  processing_fee_pct   DECIMAL(5,2) NOT NULL DEFAULT 0,
  penalty_rate_pct     DECIMAL(5,2) NOT NULL DEFAULT 0 COMMENT '% of overdue installment per period',
  insurance_rate_pct   DECIMAL(5,3) NOT NULL DEFAULT 0 COMMENT 'Credit life premium, % of principal',
  insurance_method     ENUM('none','flat','declining') NOT NULL DEFAULT 'none'
                       COMMENT 'flat = cover stays at principal; declining = cover follows the balance',
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE loans (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  loan_no             VARCHAR(20) NOT NULL UNIQUE,
  client_id           INT NOT NULL,
  product_id          INT NOT NULL,
  officer_id          INT NOT NULL,
  branch_id           INT NOT NULL,
  principal           DECIMAL(12,2) NOT NULL,
  interest_rate       DECIMAL(6,3)  NOT NULL,
  interest_method     ENUM('flat','reducing') NOT NULL,
  repayment_frequency ENUM('weekly','biweekly','monthly') NOT NULL,
  term_months         INT NOT NULL,
  installments        INT NOT NULL DEFAULT 0,
  purpose             VARCHAR(255),
  application_date    DATE NOT NULL,
  approved_by         INT NULL,
  approved_at         DATETIME NULL,
  rejection_reason    VARCHAR(255),
  disbursed_at        DATETIME NULL,
  first_due_date      DATE NULL,
  maturity_date       DATE NULL,
  processing_fee      DECIMAL(12,2) NOT NULL DEFAULT 0,
  insurance_premium   DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Credit life premium deducted at disbursement',
  total_interest      DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_payable       DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid         DECIMAL(12,2) NOT NULL DEFAULT 0,
  outstanding_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  status              ENUM('pending','approved','rejected','active','closed','defaulted','written_off')
                      NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_loan_client   FOREIGN KEY (client_id)  REFERENCES clients(id),
  CONSTRAINT fk_loan_product  FOREIGN KEY (product_id) REFERENCES loan_products(id),
  CONSTRAINT fk_loan_officer  FOREIGN KEY (officer_id) REFERENCES users(id),
  CONSTRAINT fk_loan_branch   FOREIGN KEY (branch_id)  REFERENCES branches(id),
  CONSTRAINT fk_loan_approver FOREIGN KEY (approved_by) REFERENCES users(id),
  CONSTRAINT chk_loan_principal CHECK (principal > 0),
  INDEX idx_loan_status (status),
  INDEX idx_loan_client (client_id)
) ENGINE=InnoDB;

CREATE TABLE loan_guarantors (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  loan_id      INT NOT NULL,
  full_name    VARCHAR(120) NOT NULL,
  national_id  VARCHAR(30),
  phone        VARCHAR(30),
  relationship VARCHAR(60),
  address      VARCHAR(255),
  CONSTRAINT fk_guarantor_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE loan_collateral (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  loan_id         INT NOT NULL,
  description     VARCHAR(255) NOT NULL,
  estimated_value DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_collateral_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4. Repayment schedule and receipts
-- ---------------------------------------------------------------------
CREATE TABLE repayment_schedule (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  loan_id        INT NOT NULL,
  installment_no INT NOT NULL,
  due_date       DATE NOT NULL,
  principal_due  DECIMAL(12,2) NOT NULL DEFAULT 0,
  interest_due   DECIMAL(12,2) NOT NULL DEFAULT 0,
  penalty_due    DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_due      DECIMAL(12,2) NOT NULL DEFAULT 0,
  principal_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  interest_paid  DECIMAL(12,2) NOT NULL DEFAULT 0,
  penalty_paid   DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid_at        DATETIME NULL,
  status         ENUM('pending','partial','paid','overdue') NOT NULL DEFAULT 'pending',
  UNIQUE KEY uq_schedule (loan_id, installment_no),
  CONSTRAINT fk_sched_loan FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE,
  INDEX idx_sched_due (due_date, status)
) ENGINE=InnoDB;

CREATE TABLE repayments (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  receipt_no          VARCHAR(20) NOT NULL UNIQUE,
  loan_id             INT NOT NULL,
  amount              DECIMAL(12,2) NOT NULL,
  principal_component DECIMAL(12,2) NOT NULL DEFAULT 0,
  interest_component  DECIMAL(12,2) NOT NULL DEFAULT 0,
  penalty_component   DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_date        DATE NOT NULL,
  method              ENUM('cash','bank','mobile_money') NOT NULL DEFAULT 'cash',
  received_by         INT NOT NULL,
  reference           VARCHAR(60),
  notes               VARCHAR(255),
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_repay_loan FOREIGN KEY (loan_id)     REFERENCES loans(id),
  CONSTRAINT fk_repay_user FOREIGN KEY (received_by) REFERENCES users(id),
  CONSTRAINT chk_repay_amount CHECK (amount > 0),
  INDEX idx_repay_date (payment_date)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5. Savings
-- ---------------------------------------------------------------------
CREATE TABLE savings_accounts (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  account_no    VARCHAR(20) NOT NULL UNIQUE,
  client_id     INT NOT NULL,
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  balance       DECIMAL(12,2) NOT NULL DEFAULT 0,
  status        ENUM('active','dormant','closed') NOT NULL DEFAULT 'active',
  opened_at     DATE NOT NULL DEFAULT (CURRENT_DATE),
  CONSTRAINT fk_sav_client FOREIGN KEY (client_id) REFERENCES clients(id)
) ENGINE=InnoDB;

CREATE TABLE savings_transactions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  account_id    INT NOT NULL,
  type          ENUM('deposit','withdrawal','interest','fee') NOT NULL,
  amount        DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL,
  txn_date      DATE NOT NULL,
  performed_by  INT NOT NULL,
  reference     VARCHAR(60),
  notes         VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_stx_account FOREIGN KEY (account_id)   REFERENCES savings_accounts(id),
  CONSTRAINT fk_stx_user    FOREIGN KEY (performed_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6. Beneficiaries (nominated next of kin)
--
-- A client nominates who receives their savings balance and any insurance
-- payout. Shares are percentages and the application enforces that the active
-- nominations for a client total exactly 100%.
-- ---------------------------------------------------------------------
CREATE TABLE beneficiaries (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  client_id     INT NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  relationship  ENUM('spouse','child','parent','sibling','other') NOT NULL DEFAULT 'other',
  national_id   VARCHAR(30),
  phone         VARCHAR(30),
  address       VARCHAR(255),
  date_of_birth DATE,
  share_pct     DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_beneficiary_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT chk_share CHECK (share_pct > 0 AND share_pct <= 100),
  INDEX idx_beneficiary_client (client_id, is_active)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 7. Credit life insurance
--
-- Every disbursed loan on an insured product gets one policy. The premium is
-- deducted from the disbursement; cover settles the outstanding balance if the
-- borrower dies or is permanently disabled, and any surplus goes to the
-- nominated beneficiaries.
-- ---------------------------------------------------------------------
CREATE TABLE insurance_policies (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  policy_no       VARCHAR(20) NOT NULL UNIQUE,
  loan_id         INT NOT NULL UNIQUE,
  client_id       INT NOT NULL,
  cover_method    ENUM('flat','declining') NOT NULL DEFAULT 'flat',
  cover_amount    DECIMAL(12,2) NOT NULL COMMENT 'Sum assured at inception',
  premium         DECIMAL(12,2) NOT NULL,
  premium_rate_pct DECIMAL(5,3) NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          ENUM('active','lapsed','claimed','expired','cancelled') NOT NULL DEFAULT 'active',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_policy_loan   FOREIGN KEY (loan_id)   REFERENCES loans(id)   ON DELETE CASCADE,
  CONSTRAINT fk_policy_client FOREIGN KEY (client_id) REFERENCES clients(id),
  CONSTRAINT chk_cover CHECK (cover_amount >= 0),
  INDEX idx_policy_status (status)
) ENGINE=InnoDB;

CREATE TABLE insurance_claims (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  claim_no        VARCHAR(20) NOT NULL UNIQUE,
  policy_id       INT NOT NULL,
  claim_type      ENUM('death','permanent_disability','retrenchment') NOT NULL,
  incident_date   DATE NOT NULL,
  lodged_at       DATE NOT NULL,
  lodged_by       INT NOT NULL,
  claimed_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  approved_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  loan_settled    DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Portion applied to the outstanding loan',
  paid_to_family  DECIMAL(12,2) NOT NULL DEFAULT 0 COMMENT 'Surplus paid to the beneficiaries',
  assessed_by     INT NULL,
  assessed_at     DATETIME NULL,
  decision_notes  VARCHAR(255),
  status          ENUM('lodged','assessing','approved','rejected','settled') NOT NULL DEFAULT 'lodged',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_claim_policy   FOREIGN KEY (policy_id)   REFERENCES insurance_policies(id) ON DELETE CASCADE,
  CONSTRAINT fk_claim_lodger   FOREIGN KEY (lodged_by)   REFERENCES users(id),
  CONSTRAINT fk_claim_assessor FOREIGN KEY (assessed_by) REFERENCES users(id),
  INDEX idx_claim_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 8. Notifications and audit trail
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NULL,
  loan_id    INT NULL,
  channel    ENUM('sms','email','system') NOT NULL DEFAULT 'system',
  subject    VARCHAR(120),
  message    VARCHAR(500) NOT NULL,
  status     ENUM('queued','sent','failed') NOT NULL DEFAULT 'queued',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_note_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_note_loan   FOREIGN KEY (loan_id)   REFERENCES loans(id)   ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NULL,
  action     VARCHAR(60) NOT NULL,
  entity     VARCHAR(60) NOT NULL,
  entity_id  INT NULL,
  details    JSON NULL,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_audit_entity (entity, entity_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 9. Reporting views
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_loan_portfolio AS
SELECT l.id, l.loan_no, l.status, l.principal, l.total_payable, l.amount_paid,
       l.outstanding_balance, l.branch_id, l.officer_id,
       CONCAT(c.first_name,' ',c.last_name) AS client_name, c.client_no,
       p.name AS product_name
FROM loans l
JOIN clients c       ON c.id = l.client_id
JOIN loan_products p ON p.id = l.product_id;

-- Portfolio at Risk: outstanding balance of loans with any installment overdue
CREATE OR REPLACE VIEW v_par AS
SELECT l.id AS loan_id, l.loan_no, l.outstanding_balance,
       DATEDIFF(CURDATE(), MIN(s.due_date)) AS days_overdue
FROM loans l
JOIN repayment_schedule s ON s.loan_id = l.id
WHERE l.status = 'active' AND s.status <> 'paid' AND s.due_date < CURDATE()
GROUP BY l.id, l.loan_no, l.outstanding_balance;

-- Insurance exposure: live cover against what the loan still owes.
CREATE OR REPLACE VIEW v_insurance_exposure AS
SELECT p.id, p.policy_no, p.status, p.cover_method, p.cover_amount, p.premium,
       l.loan_no, l.outstanding_balance,
       CASE WHEN p.cover_method = 'declining' THEN l.outstanding_balance
            ELSE p.cover_amount END AS current_cover,
       CONCAT(c.first_name,' ',c.last_name) AS client_name, c.client_no
FROM insurance_policies p
JOIN loans l   ON l.id = p.loan_id
JOIN clients c ON c.id = p.client_id;

-- ---------------------------------------------------------------------
-- 10. Stored routine: flag overdue installments (run daily)
-- ---------------------------------------------------------------------
DELIMITER $$
CREATE PROCEDURE sp_flag_overdue()
BEGIN
  UPDATE repayment_schedule
     SET status = 'overdue'
   WHERE status IN ('pending','partial')
     AND due_date < CURDATE();
END$$
DELIMITER ;
