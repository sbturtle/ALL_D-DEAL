import type { BudgetSettlement } from '../../domain/transactions/budget-settlement';
import { validateBudgetSettlement } from '../../domain/transactions/budget-settlement';
import type { Transaction } from '../../domain/transactions/transaction';

export type ManualBudgetSettlementRepository = Readonly<{
  getTransactionsByIds: (transactionIds: readonly string[]) => Promise<readonly Transaction[]>;
  listBudgetSettlements: () => Promise<readonly BudgetSettlement[]>;
  saveBudgetSettlement: (settlement: BudgetSettlement) => Promise<void>;
}>;

export type SaveManualBudgetSettlementResult =
  | Readonly<{ isSaved: true; settlement: BudgetSettlement }>
  | Readonly<{
      isSaved: false;
      code:
        | 'invalid_settlement'
        | 'missing_transaction'
        | 'outflows_must_be_outflow'
        | 'inflows_must_be_inflow'
        | 'transaction_already_linked'
        | 'storage_failed';
    }>;

function getParticipantIds(settlement: BudgetSettlement): readonly string[] {
  return [...settlement.outflowTransactionIds, ...settlement.inflowTransactionIds];
}

export async function saveManualBudgetSettlement(
  candidate: unknown,
  repository: ManualBudgetSettlementRepository,
): Promise<SaveManualBudgetSettlementResult> {
  const validation = validateBudgetSettlement(candidate);
  if (!validation.isValid) {
    return { isSaved: false, code: 'invalid_settlement' };
  }

  const settlement = validation.value;
  const participantIds = getParticipantIds(settlement);

  try {
    const [participants, existingSettlements] = await Promise.all([
      repository.getTransactionsByIds(participantIds),
      repository.listBudgetSettlements(),
    ]);
    const participantById = new Map(
      participants.map((transaction) => [transaction.id, transaction]),
    );
    const outflows = settlement.outflowTransactionIds.map((transactionId) =>
      participantById.get(transactionId),
    );
    const inflows = settlement.inflowTransactionIds.map((transactionId) =>
      participantById.get(transactionId),
    );

    if (
      outflows.some((item) => item === undefined) ||
      inflows.some((item) => item === undefined)
    ) {
      return { isSaved: false, code: 'missing_transaction' };
    }
    if (outflows.some((item) => item?.direction !== 'OUTFLOW')) {
      return { isSaved: false, code: 'outflows_must_be_outflow' };
    }
    if (inflows.some((item) => item?.direction !== 'INFLOW')) {
      return { isSaved: false, code: 'inflows_must_be_inflow' };
    }

    const linkedTransactionIds = new Set(
      existingSettlements.flatMap(getParticipantIds),
    );
    if (participantIds.some((transactionId) => linkedTransactionIds.has(transactionId))) {
      return { isSaved: false, code: 'transaction_already_linked' };
    }

    await repository.saveBudgetSettlement(settlement);
  } catch {
    return { isSaved: false, code: 'storage_failed' };
  }

  return { isSaved: true, settlement };
}
