const asyncHandler = require('../utils/asyncHandler');
const ReportService = require('../services/ReportService');
const { branchRepository, notificationRepository, auditRepository } = require('../repositories/SupportRepositories');

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

exports.dashboard = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await ReportService.dashboard() });
});

exports.arrears = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await ReportService.arrears() });
});

exports.collections = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await ReportService.collections({ from: req.query.from || daysAgo(30), to: req.query.to || today() }),
  });
});

exports.dueList = asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: await ReportService.dueList({ from: req.query.from || today(), to: req.query.to || daysAgo(-7) }),
  });
});

exports.officers = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await ReportService.officerPerformance() });
});

exports.products = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await ReportService.productMix() });
});

exports.branches = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await branchRepository.all() });
});

exports.notifications = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await notificationRepository.latest(25) });
});

exports.audit = asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await auditRepository.latest(100) });
});
