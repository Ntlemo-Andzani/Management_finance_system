/**
 * BeneficiaryService — who receives a client's money if they die.
 *
 * The rule the whole module exists to enforce: the active nominations for one
 * client must total exactly 100%. A payout cannot be split against shares that
 * add up to 90% or 115%, so the service refuses to leave a client in that state
 * rather than discovering it at claim time.
 */
const beneficiaryRepository = require('../repositories/BeneficiaryRepository');
const clientRepository = require('../repositories/ClientRepository');
const { publish } = require('./EventBus');
const ApiError = require('../utils/ApiError');
const { round2 } = require('../utils/money');

const TOLERANCE = 0.005;

class BeneficiaryService {
  static async list(clientId) {
    const client = await clientRepository.findById(clientId);
    if (!client) throw ApiError.notFound('Client not found');
    const beneficiaries = await beneficiaryRepository.forClient(clientId);
    const allocated = round2(beneficiaries.reduce((s, b) => s + Number(b.share_pct), 0));
    return {
      beneficiaries,
      allocated,
      unallocated: round2(100 - allocated),
      is_complete: Math.abs(allocated - 100) < TOLERANCE,
    };
  }

  static async add(clientId, data, actor) {
    const client = await clientRepository.findById(clientId);
    if (!client) throw ApiError.notFound('Client not found');

    const existing = await beneficiaryRepository.activeShare(clientId);
    const total = round2(existing + Number(data.share_pct));
    if (total > 100 + TOLERANCE) {
      throw ApiError.badRequest('Shares cannot exceed 100%', {
        share_pct: `${round2(100 - existing)}% is still unallocated — this nomination asks for ${data.share_pct}%`,
      });
    }

    const id = await beneficiaryRepository.create({ ...data, client_id: clientId, is_active: 1 });
    publish('beneficiary.added', {
      client, actorId: actor.id, entityId: id,
      details: { full_name: data.full_name, share_pct: data.share_pct },
    });
    return beneficiaryRepository.findById(id);
  }

  static async update(id, data, actor) {
    const existing = await beneficiaryRepository.findById(id);
    if (!existing) throw ApiError.notFound('Beneficiary not found');

    if (data.share_pct !== undefined) {
      const others = await beneficiaryRepository.activeShare(existing.client_id, { excludeId: id });
      if (round2(others + Number(data.share_pct)) > 100 + TOLERANCE) {
        throw ApiError.badRequest('Shares cannot exceed 100%', {
          share_pct: `The other nominations already account for ${others}%`,
        });
      }
    }

    await beneficiaryRepository.update(id, data);
    publish('beneficiary.updated', { actorId: actor.id, entityId: id, details: data });
    return beneficiaryRepository.findById(id);
  }

  /**
   * Nominations are retired, not deleted — a claim assessed years later has to
   * be able to show who was nominated at the time.
   */
  static async remove(id, actor) {
    const existing = await beneficiaryRepository.findById(id);
    if (!existing) throw ApiError.notFound('Beneficiary not found');
    await beneficiaryRepository.update(id, { is_active: 0 });
    publish('beneficiary.removed', {
      actorId: actor.id, entityId: id, details: { full_name: existing.full_name },
    });
    return { removed: true };
  }

  /**
   * Split an amount across the active nominations. Rounding remainders go to
   * the largest share so the parts always sum exactly to the whole.
   */
  static async splitPayout(clientId, amount) {
    const beneficiaries = await beneficiaryRepository.forClient(clientId);
    if (!beneficiaries.length) return [];

    const allocated = round2(beneficiaries.reduce((s, b) => s + Number(b.share_pct), 0));
    if (Math.abs(allocated - 100) > TOLERANCE) {
      throw ApiError.conflict(
        `This client's nominations total ${allocated}%, not 100%. Correct them before settling a payout.`
      );
    }

    const rows = beneficiaries.map((b) => ({
      beneficiary_id: b.id,
      full_name: b.full_name,
      relationship: b.relationship,
      share_pct: Number(b.share_pct),
      amount: round2(Number(amount) * (Number(b.share_pct) / 100)),
    }));

    const distributed = round2(rows.reduce((s, r) => s + r.amount, 0));
    if (distributed !== round2(amount)) {
      const biggest = rows.reduce((a, b) => (b.amount > a.amount ? b : a), rows[0]);
      biggest.amount = round2(biggest.amount + round2(amount - distributed));
    }
    return rows;
  }

  static missingNominations() {
    return beneficiaryRepository.missingNominations();
  }
}

module.exports = BeneficiaryService;
