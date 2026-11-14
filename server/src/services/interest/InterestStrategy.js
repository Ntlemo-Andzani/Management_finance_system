/**
 * STRATEGY design pattern — interest calculation.
 *
 * Microfinance products price money in different ways. Rather than branching on
 * `if (method === 'flat')` all over the codebase, each method is an interchangeable
 * strategy object with the same interface:
 *
 *      buildInstallments({ principal, annualRate, periods, periodsPerYear })
 *          -> [{ installmentNo, principalDue, interestDue, totalDue, balance }]
 *
 * Adding a new pricing method (e.g. declining balance with a grace period) means
 * adding one class and registering it — no existing code has to change.
 */
const { round2 } = require('../../utils/money');

class InterestStrategy {
  get name() { return 'abstract'; }

  // eslint-disable-next-line no-unused-vars
  buildInstallments(_params) {
    throw new Error('buildInstallments() must be implemented by a concrete strategy');
  }

  /** Shared rounding fix: force the sum of the parts to equal the total exactly. */
  _reconcile(rows, principal, totalInterest) {
    const sumP = round2(rows.reduce((s, r) => s + r.principalDue, 0));
    const sumI = round2(rows.reduce((s, r) => s + r.interestDue, 0));
    const last = rows[rows.length - 1];
    last.principalDue = round2(last.principalDue + round2(principal - sumP));
    last.interestDue = round2(last.interestDue + round2(totalInterest - sumI));
    last.totalDue = round2(last.principalDue + last.interestDue);
    last.balance = 0;
    return rows;
  }
}

/**
 * FLAT RATE — interest is charged on the original principal for the full term.
 * The most common method for small, short micro-loans because it is easy to
 * explain to a client at the counter.
 */
class FlatRateStrategy extends InterestStrategy {
  get name() { return 'flat'; }

  buildInstallments({ principal, annualRate, periods, periodsPerYear }) {
    const years = periods / periodsPerYear;
    const totalInterest = round2(principal * (annualRate / 100) * years);
    const principalPer = round2(principal / periods);
    const interestPer = round2(totalInterest / periods);

    let balance = principal;
    const rows = [];
    for (let i = 1; i <= periods; i += 1) {
      balance = round2(balance - principalPer);
      rows.push({
        installmentNo: i,
        principalDue: principalPer,
        interestDue: interestPer,
        totalDue: round2(principalPer + interestPer),
        balance: Math.max(balance, 0),
      });
    }
    return this._reconcile(rows, principal, totalInterest);
  }
}

/**
 * REDUCING BALANCE — interest accrues only on the outstanding balance, and the
 * instalment is a level annuity (EMI). Fairer to the client and required for
 * larger enterprise loans.
 *
 *      EMI = P * r / (1 - (1 + r)^-n)     where r = periodic rate
 */
class ReducingBalanceStrategy extends InterestStrategy {
  get name() { return 'reducing'; }

  buildInstallments({ principal, annualRate, periods, periodsPerYear }) {
    const r = annualRate / 100 / periodsPerYear;
    const emi = r === 0
      ? round2(principal / periods)
      : round2((principal * r) / (1 - Math.pow(1 + r, -periods)));

    let balance = principal;
    let totalInterest = 0;
    const rows = [];

    for (let i = 1; i <= periods; i += 1) {
      const interestDue = round2(balance * r);
      let principalDue = round2(emi - interestDue);
      if (i === periods) principalDue = round2(balance);
      balance = round2(balance - principalDue);
      totalInterest = round2(totalInterest + interestDue);
      rows.push({
        installmentNo: i,
        principalDue,
        interestDue,
        totalDue: round2(principalDue + interestDue),
        balance: Math.max(balance, 0),
      });
    }
    return this._reconcile(rows, principal, totalInterest);
  }
}

/** Registry used by the ScheduleFactory. */
const strategies = {
  flat: new FlatRateStrategy(),
  reducing: new ReducingBalanceStrategy(),
};

function getStrategy(method) {
  const strategy = strategies[method];
  if (!strategy) throw new Error(`Unknown interest method: ${method}`);
  return strategy;
}

module.exports = {
  InterestStrategy,
  FlatRateStrategy,
  ReducingBalanceStrategy,
  getStrategy,
  strategies,
};
