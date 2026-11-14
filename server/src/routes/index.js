/**
 * API route table. Every path below is mounted under /api.
 * Access rules live here so the whole permission model can be read on one screen.
 */
const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');

const auth = require('../controllers/authController');
const clients = require('../controllers/clientController');
const loans = require('../controllers/loanController');
const repayments = require('../controllers/repaymentController');
const savings = require('../controllers/savingsController');
const reports = require('../controllers/reportController');
const beneficiaries = require('../controllers/beneficiaryController');
const insurance = require('../controllers/insuranceController');

const router = express.Router();

/* ---- public ---------------------------------------------------------- */
router.post('/auth/login', auth.login);

/* ---- everything below requires a valid token ------------------------- */
router.use(requireAuth);

router.get('/auth/me', auth.me);
router.post('/auth/change-password', auth.changePassword);
router.get('/users', requireRole('admin'), auth.listUsers);
router.post('/users', requireRole('admin'), auth.createUser);
router.patch('/users/:id/active', requireRole('admin'), auth.setUserActive);

/* clients */
router.get('/clients', clients.list);
router.post('/clients', requireRole('admin', 'manager', 'officer'), clients.create);
router.get('/clients/:id', clients.show);
router.put('/clients/:id', requireRole('admin', 'manager', 'officer'), clients.update);
router.patch('/clients/:id/status', requireRole('admin', 'manager'), clients.setStatus);

/* beneficiaries — who receives the money if the client dies */
router.get('/clients/:clientId/beneficiaries', beneficiaries.list);
router.post('/clients/:clientId/beneficiaries', requireRole('admin', 'manager', 'officer'), beneficiaries.add);
router.get('/clients/:clientId/beneficiaries/preview', beneficiaries.preview);
router.put('/beneficiaries/:id', requireRole('admin', 'manager', 'officer'), beneficiaries.update);
router.delete('/beneficiaries/:id', requireRole('admin', 'manager'), beneficiaries.remove);
router.get('/reports/missing-beneficiaries', requireRole('admin', 'manager'), beneficiaries.missing);

/* credit life insurance */
router.get('/insurance/summary', insurance.summary);
router.get('/insurance/policies', insurance.policies);
router.get('/insurance/policies/:id', insurance.policy);
router.get('/insurance/claims', insurance.claims);
router.post('/insurance/claims', requireRole('admin', 'manager', 'officer'), insurance.lodge);
router.post('/insurance/claims/:id/assess', requireRole('admin', 'manager'), insurance.assess);
router.post('/insurance/claims/:id/settle', requireRole('admin'), insurance.settle);

/* loans */
router.get('/loan-products', loans.products);
router.get('/loans', loans.list);
router.post('/loans/preview', loans.preview);
router.post('/loans', requireRole('admin', 'manager', 'officer'), loans.apply);
router.get('/loans/:id', loans.show);
router.post('/loans/:id/approve', requireRole('admin', 'manager'), loans.approve);
router.post('/loans/:id/reject', requireRole('admin', 'manager'), loans.reject);
router.post('/loans/:id/disburse', requireRole('admin', 'manager'), loans.disburse);
router.post('/loans/:id/write-off', requireRole('admin'), loans.writeOff);

/* repayments */
router.get('/loans/:loanId/statement', repayments.statement);
router.get('/loans/:loanId/repayments', repayments.forLoan);
router.post('/repayments', requireRole('admin', 'manager', 'officer', 'teller'), repayments.record);
router.get('/repayments', repayments.recent);

/* savings */
router.get('/savings', savings.list);
router.post('/savings', requireRole('admin', 'manager', 'officer'), savings.open);
router.post('/savings/transactions', requireRole('admin', 'manager', 'officer', 'teller'), savings.post);
router.get('/savings/:id/statement', savings.statement);

/* reports and reference data */
router.get('/reports/dashboard', reports.dashboard);
router.get('/reports/arrears', reports.arrears);
router.get('/reports/collections', reports.collections);
router.get('/reports/due', reports.dueList);
router.get('/reports/officers', requireRole('admin', 'manager'), reports.officers);
router.get('/reports/products', reports.products);
router.get('/branches', reports.branches);
router.get('/notifications', reports.notifications);
router.get('/audit-logs', requireRole('admin'), reports.audit);

module.exports = router;
