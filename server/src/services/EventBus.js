/**
 * OBSERVER design pattern — domain events.
 *
 * Services announce what happened ("loan.approved", "repayment.recorded") without
 * knowing who cares. Observers — the SMS queue, the audit trail — subscribe once
 * at start-up. Adding a new side effect never touches the loan logic.
 */
const { EventEmitter } = require('events');
const { notificationRepository, auditRepository } = require('../repositories/SupportRepositories');

class EventBus extends EventEmitter {}
const bus = new EventBus();

const money = (n) => `R${Number(n).toFixed(2)}`;

/** Observer 1 — queues client-facing messages. */
function registerNotificationObserver() {
  bus.on('loan.approved', async ({ loan }) => {
    await notificationRepository.create({
      client_id: loan.client_id,
      loan_id: loan.id,
      channel: 'sms',
      subject: 'Loan approved',
      message: `Good news: loan ${loan.loan_no} for ${money(loan.principal)} has been approved. Collect your disbursement at your branch.`,
    });
  });

  bus.on('loan.rejected', async ({ loan, reason }) => {
    await notificationRepository.create({
      client_id: loan.client_id,
      loan_id: loan.id,
      channel: 'sms',
      subject: 'Loan decision',
      message: `Application ${loan.loan_no} was not approved. Reason: ${reason}. Speak to your loan officer about next steps.`,
    });
  });

  bus.on('loan.disbursed', async ({ loan }) => {
    await notificationRepository.create({
      client_id: loan.client_id,
      loan_id: loan.id,
      channel: 'sms',
      subject: 'Funds released',
      message: `${money(loan.principal)} has been disbursed on loan ${loan.loan_no}. First instalment is due ${loan.first_due_date}.`,
    });
  });

  bus.on('repayment.recorded', async ({ loan, repayment }) => {
    await notificationRepository.create({
      client_id: loan.client_id,
      loan_id: loan.id,
      channel: 'sms',
      subject: 'Payment received',
      message: `Receipt ${repayment.receipt_no}: ${money(repayment.amount)} received on loan ${loan.loan_no}. Balance ${money(repayment.balance_after)}.`,
    });
  });

  bus.on('insurance.claim_settled', async ({ loan, details }) => {
    await notificationRepository.create({
      client_id: loan.client_id,
      loan_id: loan.id,
      channel: 'sms',
      subject: 'Insurance claim settled',
      message: `The credit life claim on loan ${loan.loan_no} has been settled. ${money(details.toLoan)} cleared the loan`
        + (details.surplus > 0 ? ` and ${money(details.surplus)} is being paid to the nominated family.` : '.'),
    });
  });

  bus.on('loan.closed', async ({ loan }) => {
    await notificationRepository.create({
      client_id: loan.client_id,
      loan_id: loan.id,
      channel: 'sms',
      subject: 'Loan settled',
      message: `Loan ${loan.loan_no} is fully settled. Thank you — you now qualify for a repeat loan.`,
    });
  });
}

/** Observer 2 — writes the audit trail. */
function registerAuditObserver() {
  const record = (action, entity) => async (payload) => {
    // An explicit entityId wins: a beneficiary or claim event carries the loan
    // or client only as context, and the audit row must point at the record
    // that actually changed.
    const entityId = payload.entityId
      ?? payload.loan?.id ?? payload.client?.id ?? payload.account?.id ?? null;
    await auditRepository.create({
      user_id: payload.actorId || null,
      action,
      entity,
      entity_id: entityId,
      details: JSON.stringify(payload.details || {}),
      ip_address: payload.ip || null,
    });
  };

  bus.on('client.created', record('CREATE', 'client'));
  bus.on('loan.applied', record('APPLY', 'loan'));
  bus.on('loan.approved', record('APPROVE', 'loan'));
  bus.on('loan.rejected', record('REJECT', 'loan'));
  bus.on('loan.disbursed', record('DISBURSE', 'loan'));
  bus.on('repayment.recorded', record('REPAY', 'loan'));
  bus.on('savings.transaction', record('SAVINGS_TXN', 'savings_account'));
  bus.on('beneficiary.added', record('NOMINATE', 'beneficiary'));
  bus.on('beneficiary.updated', record('UPDATE', 'beneficiary'));
  bus.on('beneficiary.removed', record('WITHDRAW', 'beneficiary'));
  bus.on('insurance.claim_lodged', record('CLAIM_LODGE', 'insurance_claim'));
  bus.on('insurance.claim_approved', record('CLAIM_APPROVE', 'insurance_claim'));
  bus.on('insurance.claim_rejected', record('CLAIM_REJECT', 'insurance_claim'));
  bus.on('insurance.claim_settled', record('CLAIM_SETTLE', 'insurance_claim'));
}

/** Observers must not break the business transaction that fired the event. */
bus.on('error', (err) => console.error('[EventBus] observer failed:', err.message));

function registerObservers() {
  registerNotificationObserver();
  registerAuditObserver();
}

/** Emit without letting a failing observer reject the caller. */
function publish(event, payload) {
  setImmediate(() => {
    try {
      bus.emit(event, payload);
    } catch (err) {
      console.error(`[EventBus] ${event} failed:`, err.message);
    }
  });
}

module.exports = { bus, publish, registerObservers };
