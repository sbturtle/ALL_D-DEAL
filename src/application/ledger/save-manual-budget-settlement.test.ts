import { describe, expect, it, vi } from 'vitest';

import type { BudgetSettlement } from '../../domain/transactions/budget-settlement';
import type { Transaction } from '../../domain/transactions/transaction';
import { saveManualBudgetSettlement } from './save-manual-budget-settlement';

const payerId = '550e8400-e29b-41d4-a716-446655440001';
const reimbursementId = '550e8400-e29b-41d4-a716-446655440002';
const settlement: BudgetSettlement = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  payerOutflowTransactionId: payerId,
  reimbursementInflowTransactionIds: [reimbursementId],
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
};

function transaction(
  id: string,
  direction: Transaction['direction'],
): Transaction {
  return {
    id,
    occurredOn: '2026-08-05',
    amountMinor: 10_000,
    currency: 'KRW',
    direction,
    type: 'UNKNOWN',
    descriptionOriginal: `Fabricated ${id}`,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

describe('saveManualBudgetSettlement', () => {
  it('saves one explicit payer and reimbursement connection', async () => {
    const saveBudgetSettlement = vi.fn().mockResolvedValue(undefined);
    const result = await saveManualBudgetSettlement(settlement, {
      getTransactionsByIds: async () => [
        transaction(payerId, 'OUTFLOW'),
        transaction(reimbursementId, 'INFLOW'),
      ],
      listBudgetSettlements: async () => [],
      saveBudgetSettlement,
    });

    expect(result).toEqual({ isSaved: true, settlement });
    expect(saveBudgetSettlement).toHaveBeenCalledWith(settlement);
  });

  it('does not allow a linked transaction to be reused in another settlement', async () => {
    const result = await saveManualBudgetSettlement(settlement, {
      getTransactionsByIds: async () => [
        transaction(payerId, 'OUTFLOW'),
        transaction(reimbursementId, 'INFLOW'),
      ],
      listBudgetSettlements: async () => [
        {
          ...settlement,
          id: '550e8400-e29b-41d4-a716-446655440003',
        },
      ],
      saveBudgetSettlement: vi.fn(),
    });

    expect(result).toEqual({
      isSaved: false,
      code: 'transaction_already_linked',
    });
  });

  it('rejects a reimbursement that is not an inflow', async () => {
    const result = await saveManualBudgetSettlement(settlement, {
      getTransactionsByIds: async () => [
        transaction(payerId, 'OUTFLOW'),
        transaction(reimbursementId, 'OUTFLOW'),
      ],
      listBudgetSettlements: async () => [],
      saveBudgetSettlement: vi.fn(),
    });

    expect(result).toEqual({
      isSaved: false,
      code: 'reimbursements_must_be_inflow',
    });
  });
});
