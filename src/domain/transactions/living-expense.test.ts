import { describe, expect, it } from 'vitest';

import { calculateLivingExpenseSummary, isLivingExpense } from './living-expense';
import type { Transaction } from './transaction';
import {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_TYPES,
} from './transaction';

const livingExpenseCases = TRANSACTION_TYPES.flatMap((type) =>
  TRANSACTION_DIRECTIONS.map((direction) => ({
    type,
    direction,
    expected: type === 'EXPENSE' && direction === 'OUTFLOW',
  })),
);

describe('isLivingExpense', () => {
  it.each(livingExpenseCases)(
    '$type + $direction의 생활비 포함 여부를 $expected로 판정한다',
    ({ type, direction, expected }) => {
      expect(isLivingExpense({ type, direction })).toBe(expected);
    },
  );

  it('카드대금 납부를 생활비로 다시 집계하지 않는다', () => {
    expect(
      isLivingExpense({ type: 'CARD_PAYMENT', direction: 'OUTFLOW' }),
    ).toBe(false);
  });

  it.each(TRANSACTION_DIRECTIONS)(
    '%s 이체를 생활비로 집계하지 않는다',
    (direction) => {
      expect(isLivingExpense({ type: 'TRANSFER', direction })).toBe(false);
    },
  );

  it('유출 방향만으로 생활비라고 판단하지 않는다', () => {
    expect(isLivingExpense({ type: 'SAVING', direction: 'OUTFLOW' })).toBe(
      false,
    );
  });
});

function transaction(
  id: string,
  occurredOn: string,
  amountMinor: number,
  direction: Transaction['direction'],
  type: Transaction['type'],
): Transaction {
  return {
    id,
    occurredOn: occurredOn as Transaction['occurredOn'],
    amountMinor,
    currency: 'KRW',
    direction,
    type,
    descriptionOriginal: `Example ${id}`,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

describe('calculateLivingExpenseSummary', () => {
  it('uses the payer date and net amount for a linked group payment', () => {
    const payer = transaction(
      '550e8400-e29b-41d4-a716-446655440001',
      '2026-08-03',
      90_000,
      'OUTFLOW',
      'UNKNOWN',
    );
    const reimbursement = transaction(
      '550e8400-e29b-41d4-a716-446655440002',
      '2026-08-06',
      60_000,
      'INFLOW',
      'UNKNOWN',
    );
    const ordinaryExpense = transaction(
      '550e8400-e29b-41d4-a716-446655440003',
      '2026-08-03',
      20_000,
      'OUTFLOW',
      'EXPENSE',
    );

    expect(
      calculateLivingExpenseSummary(
        [payer, reimbursement, ordinaryExpense],
        [
          {
            id: '550e8400-e29b-41d4-a716-446655440004',
            payerOutflowTransactionId: payer.id,
            reimbursementInflowTransactionIds: [reimbursement.id],
            createdAt: '2026-08-06T00:00:00.000Z',
            updatedAt: '2026-08-06T00:00:00.000Z',
          },
        ],
        { startOn: '2026-08-03', endOn: '2026-08-03' },
      ),
    ).toEqual({
      unlinkedExpenseAmountMinor: 20_000,
      sharedPaymentExpenseAmountMinor: 30_000,
      totalAmountMinor: 50_000,
      sharedPaymentCount: 1,
    });
  });

  it('does not make living expense negative when reimbursements exceed the payer', () => {
    const payer = transaction(
      '550e8400-e29b-41d4-a716-446655440011',
      '2026-08-03',
      50_000,
      'OUTFLOW',
      'EXPENSE',
    );
    const reimbursement = transaction(
      '550e8400-e29b-41d4-a716-446655440012',
      '2026-08-04',
      60_000,
      'INFLOW',
      'INCOME',
    );

    expect(
      calculateLivingExpenseSummary(
        [payer, reimbursement],
        [
          {
            id: '550e8400-e29b-41d4-a716-446655440013',
            payerOutflowTransactionId: payer.id,
            reimbursementInflowTransactionIds: [reimbursement.id],
            createdAt: '2026-08-04T00:00:00.000Z',
            updatedAt: '2026-08-04T00:00:00.000Z',
          },
        ],
        { startOn: '2026-08-01', endOn: '2026-08-31' },
      ).totalAmountMinor,
    ).toBe(0);
  });
});
