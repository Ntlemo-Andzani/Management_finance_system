/**
 * FACTORY design pattern — repayment schedule construction.
 *
 * The factory decides which interest Strategy to use, converts the loan term into
 * a number of periods for the chosen repayment frequency, and attaches real due
 * dates. Callers hand over a loan and receive a complete, dated schedule.
 */
const { getStrategy } = require('./InterestStrategy');
const { round2 } = require('../../utils/money');

const PERIODS_PER_YEAR = { weekly: 52, biweekly: 26, monthly: 12 };

function addPeriods(startDate, frequency, count) {
  const d = new Date(startDate.getTime());
  if (frequency === 'weekly') d.setDate(d.getDate() + 7 * count);
  else if (frequency === 'biweekly') d.setDate(d.getDate() + 14 * count);
  else {
    const targetDay = d.getDate();
    d.setMonth(d.getMonth() + count);
    // Guard against 31 Jan + 1 month = 3 March
    if (d.getDate() < targetDay) d.setDate(0);
  }
  return d;
}

const toISODate = (d) => d.toISOString().slice(0, 10);

class ScheduleFactory {
  /** Number of instalments implied by a term in months at a given frequency. */
  static periodsFor(termMonths, frequency) {
    const perYear = PERIODS_PER_YEAR[frequency];
    if (!perYear) throw new Error(`Unknown repayment frequency: ${frequency}`);
    return Math.max(1, Math.round((termMonths / 12) * perYear));
  }

  /**
   * @returns {{installments:Array, totals:{totalInterest:number,totalPayable:number,
   *            installments:number, firstDueDate:string, maturityDate:string}}}
   */
  static create({ principal, annualRate, termMonths, frequency, method, startDate }) {
    const periods = ScheduleFactory.periodsFor(termMonths, frequency);
    const perYear = PERIODS_PER_YEAR[frequency];
    const strategy = getStrategy(method);

    const rows = strategy.buildInstallments({
      principal: Number(principal),
      annualRate: Number(annualRate),
      periods,
      periodsPerYear: perYear,
    });

    const start = startDate ? new Date(startDate) : new Date();
    const installments = rows.map((row) => ({
      ...row,
      dueDate: toISODate(addPeriods(start, frequency, row.installmentNo)),
    }));

    const totalInterest = round2(installments.reduce((s, r) => s + r.interestDue, 0));
    const totalPayable = round2(Number(principal) + totalInterest);

    return {
      installments,
      totals: {
        totalInterest,
        totalPayable,
        installments: periods,
        installmentAmount: installments[0].totalDue,
        firstDueDate: installments[0].dueDate,
        maturityDate: installments[installments.length - 1].dueDate,
      },
    };
  }
}

module.exports = { ScheduleFactory, PERIODS_PER_YEAR };
