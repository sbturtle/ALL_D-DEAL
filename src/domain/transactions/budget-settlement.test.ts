import { describe, expect, it } from 'vitest';

import { validateBudgetSettlement } from './budget-settlement';

const validSettlement = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  payerOutflowTransactionId: '550e8400-e29b-41d4-a716-446655440001',
  reimbursementInflowTransactionIds: [
    '550e8400-e29b-41d4-a716-446655440002',
    '550e8400-e29b-41d4-a716-446655440003',
  ],
  createdAt: '2026-08-05T07:30:00.000Z',
  updatedAt: '2026-08-05T07:30:00.000Z',
} as const;

describe('validateBudgetSettlement', () => {
  it('accepts one payer and unique reimbursement inflows', () => {
    expect(validateBudgetSettlement(validSettlement)).toEqual({
      isValid: true,
      value: validSettlement,
    });
  });

  it('requires at least one unique reimbursement transaction', () => {
    const result = validateBudgetSettlement({
      ...validSettlement,
      reimbursementInflowTransactionIds: [
        validSettlement.reimbursementInflowTransactionIds[0],
        validSettlement.reimbursementInflowTransactionIds[0],
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        isValid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            field: 'reimbursementInflowTransactionIds',
            code: 'invalid_reimbursement_ids',
          }),
        ]),
      }),
    );
  });

  it('rejects a payer repeated as a reimbursement', () => {
    const result = validateBudgetSettlement({
      ...validSettlement,
      reimbursementInflowTransactionIds: [
        validSettlement.payerOutflowTransactionId,
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        isValid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'payer_is_reimbursement' }),
        ]),
      }),
    );
  });
});
