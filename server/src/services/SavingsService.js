/** SavingsService — passbook accounts, deposits and withdrawals. */
const db = require('../config/db');
const savingsRepository = require('../repositories/SavingsRepository');
const clientRepository = require('../repositories/ClientRepository');
const { publish } = require('./EventBus');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');

class SavingsService {
  static async open({ client_id, interest_rate = 4.5, opening_deposit = 0 }, actor) {
    const client = await clientRepository.findById(client_id);
    if (!client) throw ApiError.notFound('Client not found');

    return db.transaction(async (tx) => {
      const account_no = await savingsRepository.nextAccountNo(tx);
      const balance = round2(opening_deposit);
      const id = await savingsRepository.create({ account_no, client_id, interest_rate, balance }, tx);

      if (balance > 0) {
        await savingsRepository.addTransaction({
          account_id: id, type: 'deposit', amount: balance, balance_after: balance,
          txn_date: new Date().toISOString().slice(0, 10), performed_by: actor.id,
          reference: 'Opening deposit',
        }, tx);
      }
      return savingsRepository.findById(id, tx);
    });
  }

  static async post({ account_id, type, amount, txn_date, reference, notes }, actor) {
    if (amount <= 0) throw ApiError.badRequest('Enter an amount greater than zero');

    return db.transaction(async (tx) => {
      const account = await tx.queryOne('SELECT * FROM savings_accounts WHERE id = ? FOR UPDATE', [account_id]);
      if (!account) throw ApiError.notFound('Savings account not found');
      if (account.status !== 'active') throw ApiError.conflict('This account is not active');

      const delta = type === 'withdrawal' || type === 'fee' ? -amount : amount;
      const balance_after = round2(Number(account.balance) + delta);
      if (balance_after < 0) {
        throw ApiError.badRequest(`Balance is R${Number(account.balance).toFixed(2)} — that withdrawal would overdraw the account`);
      }

      await savingsRepository.addTransaction({
        account_id, type, amount, balance_after,
        txn_date: txn_date || new Date().toISOString().slice(0, 10),
        performed_by: actor.id, reference, notes,
      }, tx);
      await tx.query('UPDATE savings_accounts SET balance = ? WHERE id = ?', [balance_after, account_id]);

      const updated = await savingsRepository.findById(account_id, tx);
      publish('savings.transaction', { account: updated, actorId: actor.id, details: { type, amount, balance_after } });
      return updated;
    });
  }

  static async statement(accountId) {
    const account = await savingsRepository.findById(accountId);
    if (!account) throw ApiError.notFound('Savings account not found');
    const transactions = await savingsRepository.transactions(accountId);
    return { ...account, transactions };
  }
}

module.exports = SavingsService;
