/** ReportService — read-only management information. */
const db = require('../config/db');
const loanRepository = require('../repositories/LoanRepository');
const scheduleRepository = require('../repositories/ScheduleRepository');
const repaymentRepository = require('../repositories/RepaymentRepository');
const { round2 } = require('../utils/money');

class ReportService {
  static async dashboard() {
    const [summary, trend, collections, arrears] = await Promise.all([
      loanRepository.portfolioSummary(),
      loanRepository.monthlyDisbursementTrend(),
      repaymentRepository.collectionsByDay(14),
      scheduleRepository.arrears(),
    ]);

    const outstanding = Number(summary.outstanding) || 0;
    const atRisk = round2(arrears.reduce((s, r) => s + Number(r.outstanding_balance || 0), 0));
    // PAR is measured on distinct loans, not instalments.
    const distinct = new Map();
    arrears.forEach((r) => distinct.set(r.loan_id, Number(r.outstanding_balance || 0)));
    const parAmount = round2([...distinct.values()].reduce((s, v) => s + v, 0));

    return {
      summary,
      par: {
        amount: parAmount,
        ratio: outstanding ? round2((parAmount / outstanding) * 100) : 0,
        loans_in_arrears: distinct.size,
      },
      trend,
      collections,
      arrears: arrears.slice(0, 10),
      unusedAtRisk: atRisk,
    };
  }

  static arrears() { return scheduleRepository.arrears(); }

  static collections({ from, to }) { return repaymentRepository.recent({ from, to, limit: 500 }); }

  static dueList({ from, to }) { return scheduleRepository.dueBetween(from, to); }

  static async officerPerformance() {
    return db.query(
      `SELECT u.id, u.full_name AS officer, b.name AS branch,
              COUNT(DISTINCT l.id)                       AS loans,
              IFNULL(SUM(l.principal),0)                 AS disbursed,
              IFNULL(SUM(l.outstanding_balance),0)       AS outstanding,
              SUM(CASE WHEN l.status='closed' THEN 1 ELSE 0 END)    AS closed,
              SUM(CASE WHEN l.status='defaulted' OR l.status='written_off' THEN 1 ELSE 0 END) AS bad
         FROM users u
         JOIN branches b ON b.id = u.branch_id
    LEFT JOIN loans l    ON l.officer_id = u.id AND l.status <> 'rejected'
        WHERE u.role IN ('officer','manager')
        GROUP BY u.id, u.full_name, b.name
        ORDER BY disbursed DESC`
    );
  }

  static async productMix() {
    return db.query(
      `SELECT p.name AS product, COUNT(l.id) AS loans,
              IFNULL(SUM(l.principal),0) AS disbursed,
              IFNULL(SUM(l.outstanding_balance),0) AS outstanding
         FROM loan_products p
    LEFT JOIN loans l ON l.product_id = p.id AND l.status IN ('active','closed')
        GROUP BY p.id, p.name ORDER BY disbursed DESC`
    );
  }
}

module.exports = ReportService;
