/** ClientService — client onboarding and KYC state. */
const clientRepository = require('../repositories/ClientRepository');
const loanRepository = require('../repositories/LoanRepository');
const savingsRepository = require('../repositories/SavingsRepository');
const { publish } = require('./EventBus');
const ApiError = require('../utils/ApiError');

class ClientService {
  static async register(data, actor) {
    const duplicate = await clientRepository.findByNationalId(data.national_id);
    if (duplicate) throw ApiError.conflict(`${duplicate.first_name} ${duplicate.last_name} (${duplicate.client_no}) is already registered with this ID number`);

    const client_no = await clientRepository.nextClientNo();
    const id = await clientRepository.create({
      ...data,
      client_no,
      branch_id: data.branch_id || actor.branchId,
      officer_id: data.officer_id || actor.id,
      status: 'pending',
    });

    const client = await clientRepository.findDetailed(id);
    publish('client.created', { client, actorId: actor.id, details: { client_no } });
    return client;
  }

  static async profile(id) {
    const client = await clientRepository.findDetailed(id);
    if (!client) throw ApiError.notFound('Client not found');
    const [loans, savings] = await Promise.all([
      loanRepository.search({ clientId: id }),
      savingsRepository.findForClient(id),
    ]);
    return { ...client, loans, savings };
  }

  static async setStatus(id, status) {
    const client = await clientRepository.findById(id);
    if (!client) throw ApiError.notFound('Client not found');
    if (status === 'inactive' || status === 'blacklisted') {
      const open = await loanRepository.findWhere("client_id = ? AND status IN ('active','approved')", [id]);
      if (open.length && status === 'inactive') {
        throw ApiError.conflict('This client still has a running loan, so the profile cannot be deactivated');
      }
    }
    await clientRepository.update(id, { status });
    return clientRepository.findDetailed(id);
  }

  static async update(id, data) {
    const client = await clientRepository.findById(id);
    if (!client) throw ApiError.notFound('Client not found');
    await clientRepository.update(id, data);
    return clientRepository.findDetailed(id);
  }
}

module.exports = ClientService;
