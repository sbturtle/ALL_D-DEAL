import { describe, expect, it } from 'vitest';

import {
  calculateBudgetBucketExpenseSummary,
  calculateLivingExpenseSummary,
  isLivingExpense,
} from './living-expense';
import type { Transaction } from './transaction';
import {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_TYPES,
} from './transaction';

const livingExpenseCases = TRANSACTION_TYPES.flatMap((type) =>
  TRANSACTION_DIRECTIONS.map((direction) => ({
    type,
    direction,
    budgetBucketId: 'LIVING' as const,
    expected: type === 'EXPENSE' && direction === 'OUTFLOW',
  })),
);

describe('isLivingExpense', () => {
  it.each(livingExpenseCases)(
    '$type + $direction의 생활비 포함 여부를 $expected로 판정한다',
    ({ type, direction, budgetBucketId, expected }) => {
      expect(isLivingExpense({ type, direction, budgetBucketId })).toBe(expected);
    },
  );

  it('카드대금 납부를 생활비로 다시 집계하지 않는다', () => {
    expect(
      isLivingExpense({ type: 'CARD_PAYMENT', direction: 'OUTFLOW', budgetBucketId: 'LIVING' }),
    ).toBe(false);
  });

  it.each(TRANSACTION_DIRECTIONS)(
    '%s 이체를 생활비로 집계하지 않는다',
    (direction) => {
      expect(isLivingExpense({ type: 'TRANSFER', direction, budgetBucketId: 'LIVING' })).toBe(false);
    },
  );

  it('유출 방향만으로 생활비라고 판단하지 않는다', () => {
    expect(isLivingExpense({ type: 'SAVING', direction: 'OUTFLOW', budgetBucketId: 'LIVING' })).toBe(
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
  budgetBucketId: Transaction['budgetBucketId'] = 'LIVING',
): Transaction {
  return {
    id,
    occurredOn: occurredOn as Transaction['occurredOn'],
    amountMinor,
    currency: 'KRW',
    direction,
    type,
    budgetBucketId,
    descriptionOriginal: `Example ${id}`,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

describe('calculateLivingExpenseSummary', () => {
  it('separates total consumption from living, irregular, and emergency buckets', () => {
    const cafe = transaction(
      '550e8400-e29b-41d4-a716-446655440021',
      '2026-08-05',
      6_300,
      'OUTFLOW',
      'EXPENSE',
      'LIVING',
    );
    const meal = transaction(
      '550e8400-e29b-41d4-a716-446655440022',
      '2026-08-05',
      10_000,
      'OUTFLOW',
      'EXPENSE',
      'LIVING',
    );
    const weddingGift = transaction(
      '550e8400-e29b-41d4-a716-446655440023',
      '2026-08-05',
      100_000,
      'OUTFLOW',
      'EXPENSE',
      'IRREGULAR',
    );
    const hospital = transaction(
      '550e8400-e29b-41d4-a716-446655440024',
      '2026-08-05',
      150_000,
      'OUTFLOW',
      'EXPENSE',
      'EMERGENCY',
    );
    const transactions = [cafe, meal, weddingGift, hospital];
    const range = { startOn: '2026-08-01', endOn: '2026-08-31' } as const;

    const living = calculateBudgetBucketExpenseSummary(
      transactions,
      [],
      range,
      'LIVING',
    );
    const irregular = calculateBudgetBucketExpenseSummary(
      transactions,
      [],
      range,
      'IRREGULAR',
    );
    const emergency = calculateBudgetBucketExpenseSummary(
      transactions,
      [],
      range,
      'EMERGENCY',
    );

    expect(living.totalAmountMinor).toBe(16_300);
    expect(irregular.totalAmountMinor).toBe(100_000);
    expect(emergency.totalAmountMinor).toBe(150_000);
    expect(
      living.totalAmountMinor +
        irregular.totalAmountMinor +
        emergency.totalAmountMinor,
    ).toBe(266_300);
    expect(calculateLivingExpenseSummary(transactions, [], range).totalAmountMinor).toBe(
      16_300,
    );
  });

  it('does not classify a non-living expense as living expense', () => {
    expect(
      isLivingExpense({
        type: 'EXPENSE',
        direction: 'OUTFLOW',
        budgetBucketId: 'IRREGULAR',
      }),
    ).toBe(false);
  });

  it('sums multiple linked outflows and nets later inflows', () => {
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
    const secondPayer = transaction(
      '550e8400-e29b-41d4-a716-446655440004',
      '2026-08-03',
      40_000,
      'OUTFLOW',
      'EXPENSE',
    );
    const secondReimbursement = transaction(
      '550e8400-e29b-41d4-a716-446655440005',
      '2026-08-07',
      20_000,
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
        [payer, reimbursement, secondPayer, secondReimbursement, ordinaryExpense],
        [
          {
            id: '550e8400-e29b-41d4-a716-446655440004',
            outflowTransactionIds: [payer.id, secondPayer.id],
            inflowTransactionIds: [reimbursement.id, secondReimbursement.id],
            budgetBucketId: 'LIVING',
            createdAt: '2026-08-06T00:00:00.000Z',
            updatedAt: '2026-08-06T00:00:00.000Z',
          },
        ],
        { startOn: '2026-08-03', endOn: '2026-08-03' },
      ),
    ).toEqual({
      unlinkedExpenseAmountMinor: 20_000,
      sharedPaymentExpenseAmountMinor: 50_000,
      totalAmountMinor: 70_000,
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
            outflowTransactionIds: [payer.id],
            inflowTransactionIds: [reimbursement.id],
            budgetBucketId: 'LIVING',
            createdAt: '2026-08-04T00:00:00.000Z',
            updatedAt: '2026-08-04T00:00:00.000Z',
          },
        ],
        { startOn: '2026-08-01', endOn: '2026-08-31' },
      ).totalAmountMinor,
    ).toBe(0);
  });
});
