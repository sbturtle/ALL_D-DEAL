import { describe, expect, it } from 'vitest';

import type { Transaction } from './transaction';
import { calculateSpendingInsights } from './spending-insights';

const baseTransaction: Transaction = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  occurredOn: '2026-08-01',
  amountMinor: 10_000,
  currency: 'KRW',
  direction: 'OUTFLOW',
  type: 'EXPENSE',
  categoryId: 'DATE',
  budgetBucketId: 'LIVING',
  descriptionOriginal: '떡볶이',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function createTransaction(
  overrides: Partial<Transaction> = {},
): Transaction {
  return { ...baseTransaction, ...overrides };
}

describe('calculateSpendingInsights', () => {
  it('같은 카테고리의 정규화된 기록을 반복 횟수와 총액으로 묶는다', () => {
    const insights = calculateSpendingInsights([
      createTransaction({ id: 'date-1', amountMinor: 12_000 }),
      createTransaction({
        id: 'date-2',
        amountMinor: 15_000,
        descriptionOriginal: ' 떡-볶이 ',
      }),
      createTransaction({
        id: 'food-1',
        categoryId: 'FOOD_DINING',
        descriptionOriginal: '떡볶이',
        amountMinor: 20_000,
      }),
    ]);

    expect(insights).toEqual([
      {
        categoryId: 'DATE',
        label: '떡볶이',
        count: 2,
        totalAmountMinor: 27_000,
        transactionIds: ['date-1', 'date-2'],
      },
    ]);
  });

  it('단건·미분류·비용이 아닌 거래와 제외된 공동결제를 숨긴다', () => {
    const insights = calculateSpendingInsights(
      [
        createTransaction({ id: 'kept-1', amountMinor: 12_000 }),
        createTransaction({
          id: 'excluded-1',
          amountMinor: 15_000,
          descriptionOriginal: '떡볶이',
        }),
        createTransaction({
          id: 'income-1',
          direction: 'INFLOW',
        }),
        createTransaction({
          id: 'transfer-1',
          type: 'TRANSFER',
        }),
        createTransaction({
          id: 'uncategorized-1',
          categoryId: undefined,
        }),
        createTransaction({
          id: 'single-1',
          descriptionOriginal: '카페',
        }),
      ],
      new Set(['excluded-1']),
    );

    expect(insights).toEqual([]);
  });

  it('반복 횟수, 총액, 카테고리와 기록명 순서로 안정적으로 정렬한다', () => {
    const insights = calculateSpendingInsights([
      createTransaction({
        id: 'cafe-1',
        categoryId: 'CAFE',
        descriptionOriginal: '커피',
        amountMinor: 5_000,
      }),
      createTransaction({
        id: 'cafe-2',
        categoryId: 'CAFE',
        descriptionOriginal: '커피',
        amountMinor: 6_000,
      }),
      createTransaction({
        id: 'date-1',
        descriptionOriginal: '영화',
        amountMinor: 15_000,
      }),
      createTransaction({
        id: 'date-2',
        descriptionOriginal: '영화',
        amountMinor: 15_000,
      }),
      createTransaction({
        id: 'date-3',
        descriptionOriginal: '영화',
        amountMinor: 15_000,
      }),
    ]);

    expect(insights.map(({ categoryId, label, count, totalAmountMinor }) => ({
      categoryId,
      label,
      count,
      totalAmountMinor,
    }))).toEqual([
      {
        categoryId: 'DATE',
        label: '영화',
        count: 3,
        totalAmountMinor: 45_000,
      },
      {
        categoryId: 'CAFE',
        label: '커피',
        count: 2,
        totalAmountMinor: 11_000,
      },
    ]);
  });
});
