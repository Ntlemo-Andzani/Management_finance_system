/**
 * Unit tests for the interest strategies and schedule factory.
 * Run with:  npm test    (no database required)
 */
const assert = require('assert');
const { ScheduleFactory } = require('../src/services/interest/ScheduleFactory');
const { getStrategy } = require('../src/services/interest/InterestStrategy');
const RepaymentService = require('../src/services/RepaymentService');
const { getPremiumStrategy } = require('../src/services/insurance/PremiumStrategy');

let passed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`  PASS  ${name}`); }
  catch (err) { console.error(`  FAIL  ${name}\n        ${err.message}`); process.exitCode = 1; }
}

console.log('\nTC-01..TC-06  Interest and schedule calculations\n');

test('TC-01 flat rate: R10 000 at 24% for 12 months yields R2 400 interest', () => {
  const { totals } = ScheduleFactory.create({
    principal: 10000, annualRate: 24, termMonths: 12, frequency: 'monthly', method: 'flat', startDate: '2026-08-01',
  });
  assert.strictEqual(totals.totalInterest, 2400);
  assert.strictEqual(totals.totalPayable, 12400);
  assert.strictEqual(totals.installments, 12);
  assert.strictEqual(totals.installmentAmount, 1033.33);
});

test('TC-02 flat rate: instalments sum exactly to the total payable', () => {
  const { installments, totals } = ScheduleFactory.create({
    principal: 7333, annualRate: 30, termMonths: 7, frequency: 'monthly', method: 'flat', startDate: '2026-08-01',
  });
  const sum = installments.reduce((s, r) => s + r.totalDue, 0);
  assert.strictEqual(Math.round(sum * 100) / 100, totals.totalPayable);
});

test('TC-03 reducing balance: closing balance is zero and EMI is level', () => {
  const { installments } = ScheduleFactory.create({
    principal: 50000, annualRate: 18, termMonths: 12, frequency: 'monthly', method: 'reducing', startDate: '2026-08-01',
  });
  assert.strictEqual(installments[installments.length - 1].balance, 0);
  assert.ok(Math.abs(installments[0].totalDue - installments[5].totalDue) < 0.02);
});

test('TC-04 reducing balance charges less interest than flat at the same rate', () => {
  const flat = ScheduleFactory.create({ principal: 20000, annualRate: 20, termMonths: 12, frequency: 'monthly', method: 'flat' });
  const red  = ScheduleFactory.create({ principal: 20000, annualRate: 20, termMonths: 12, frequency: 'monthly', method: 'reducing' });
  assert.ok(red.totals.totalInterest < flat.totals.totalInterest);
});

test('TC-05 weekly product over 3 months produces 13 dated instalments', () => {
  const { installments, totals } = ScheduleFactory.create({
    principal: 5000, annualRate: 30, termMonths: 3, frequency: 'weekly', method: 'flat', startDate: '2026-08-01',
  });
  assert.strictEqual(totals.installments, 13);
  assert.strictEqual(installments[0].dueDate, '2026-08-08');
  assert.strictEqual(installments.length, 13);
});

test('TC-06 unknown interest method is rejected', () => {
  assert.throws(() => getStrategy('compound-daily'), /Unknown interest method/);
});

console.log('\nTC-07..TC-09  Penalty rules\n');

test('TC-07 no penalty before the due date', () => {
  const inst = { due_date: '2026-12-01', total_due: 1000, principal_paid: 0, interest_paid: 0, penalty_paid: 0 };
  assert.strictEqual(RepaymentService.calculatePenalty(inst, 5, new Date('2026-11-20')), 0);
});

test('TC-08 5% penalty applies once for the first month overdue', () => {
  const inst = { due_date: '2026-07-01', total_due: 1000, principal_paid: 0, interest_paid: 0, penalty_paid: 0 };
  assert.strictEqual(RepaymentService.calculatePenalty(inst, 5, new Date('2026-07-20')), 50);
});

test('TC-09 penalty never exceeds the unpaid instalment', () => {
  const inst = { due_date: '2024-01-01', total_due: 1000, principal_paid: 0, interest_paid: 0, penalty_paid: 0 };
  assert.strictEqual(RepaymentService.calculatePenalty(inst, 10, new Date('2026-08-01')), 1000);
});

console.log('\nTC-10..TC-14  Credit life premium strategies\n');

test('TC-10 flat cover is the full amount repayable, not just the principal', () => {
  const q = getPremiumStrategy('flat').price({
    principal: 10000, totalPayable: 12400, termMonths: 12, ratePct: 1.5,
  });
  assert.strictEqual(q.coverAmount, 12400);
  assert.strictEqual(q.premium, 186);          // 1.5% of 12 400 for one year
});

test('TC-11 flat premium scales with the term', () => {
  const oneYear = getPremiumStrategy('flat').price({ principal: 10000, totalPayable: 10000, termMonths: 12, ratePct: 2 });
  const twoYear = getPremiumStrategy('flat').price({ principal: 10000, totalPayable: 10000, termMonths: 24, ratePct: 2 });
  assert.strictEqual(twoYear.premium, round(oneYear.premium * 2));
});

test('TC-12 declining cover is cheaper than flat at the same rate', () => {
  const args = { principal: 40000, totalPayable: 48000, termMonths: 24, ratePct: 1.2 };
  const flat = getPremiumStrategy('flat').price(args);
  const dec = getPremiumStrategy('declining').price(args);
  assert.ok(dec.premium < flat.premium, `${dec.premium} should be below ${flat.premium}`);
  assert.strictEqual(dec.coverMethod, 'declining');
});

test('TC-13 an uninsured product prices at zero without throwing', () => {
  const q = getPremiumStrategy('none').price({ principal: 5000, totalPayable: 6500, termMonths: 6, ratePct: 0 });
  assert.strictEqual(q.premium, 0);
  assert.strictEqual(q.coverAmount, 0);
});

test('TC-14 an unknown insurance method is rejected', () => {
  assert.throws(() => getPremiumStrategy('mutual-aid'), /Unknown insurance method/);
});

function round(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

console.log(`\n${passed}/14 checks passed\n`);
