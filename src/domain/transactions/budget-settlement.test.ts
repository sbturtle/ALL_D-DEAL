import { describe, expect, it } from 'vitest';

import { validateBudgetSettlement } from './budget-settlement';

const validSettlement = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  outflowTransactionIds: [
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440002',
  ],
  inflowTransactionIds: [
    '550e8400-e29b-41d4-a716-446655440003',
    '550e8400-e29b-41d4-a716-446655440004',
  ],
  createdAt: '2026-08-05T07:30:00.000Z',
  updatedAt: '2026-08-05T07:30:00.000Z',
} as const;

describe('validateBudgetSettlement', () => {
  it('accepts multiple unique outflows and inflows', () => {
    expect(validateBudgetSettlement(validSettlement)).toEqual({
      isValid: true,
      value: validSettlement,
    });
  });

  it('requires at least one unique inflow transaction', () => {
    const result = validateBudgetSettlement({
      ...validSettlement,
      inflowTransactionIds: [
        validSettlement.inflowTransactionIds[0],
        validSettlement.inflowTransactionIds[0],
      ],
    });

    expect(result).toEqual(
      expect.objectContaining({
        isValid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({
            field: 'inflowTransactionIds',
            code: 'invalid_inflow_ids',
          }),
        ]),
      }),
    );
  });

  it('rejects a transaction repeated across outflow and inflow', () => {
    const result = validateBudgetSettlement({
      ...validSettlement,
      inflowTransactionIds: [validSettlement.outflowTransactionIds[0]],
    });

    expect(result).toEqual(
      expect.objectContaining({
        isValid: false,
        issues: expect.arrayContaining([
          expect.objectContaining({ code: 'overlapping_transaction_ids' }),
        ]),
      }),
    );
  });
});
