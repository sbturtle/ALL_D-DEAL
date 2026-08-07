import { describe, expect, it } from 'vitest';

import type { Transaction } from './transaction';
import {
  isCategoryReviewNeededTransaction,
  isReviewNeededTransaction,
  isTransactionTypeReviewNeeded,
} from './review-needed';

const baseTransaction: Transaction = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  occurredOn: '2026-08-07',
  amountMinor: 12_000,
  currency: 'KRW',
  direction: 'OUTFLOW',
  type: 'EXPENSE',
  descriptionOriginal: 'Fabricated category review expense',
  createdAt: '2026-08-07T00:00:00.000Z',
  updatedAt: '2026-08-07T00:00:00.000Z',
};

describe('review-needed transaction rules', () => {
  it('keeps an uncategorized expense in the category review queue', () => {
    expect(isCategoryReviewNeededTransaction(baseTransaction)).toBe(true);
    expect(isTransactionTypeReviewNeeded(baseTransaction)).toBe(false);
    expect(isReviewNeededTransaction(baseTransaction)).toBe(true);
  });

  it('keeps UNKNOWN as a transaction-type review even with a category', () => {
    const unknownTransaction: Transaction = {
      ...baseTransaction,
      type: 'UNKNOWN',
      categoryId: 'OTHER',
    };

    expect(isCategoryReviewNeededTransaction(unknownTransaction)).toBe(false);
    expect(isTransactionTypeReviewNeeded(unknownTransaction)).toBe(true);
    expect(isReviewNeededTransaction(unknownTransaction)).toBe(true);
  });

  it('does not require a category review for income, transfer, or categorized expense', () => {
    const categorizedExpense: Transaction = {
      ...baseTransaction,
      categoryId: 'FOOD_DINING',
    };
    const income: Transaction = {
      ...baseTransaction,
      type: 'INCOME',
      direction: 'INFLOW',
    };
    const transfer: Transaction = {
      ...baseTransaction,
      type: 'TRANSFER',
    };

    [categorizedExpense, income, transfer].forEach((transaction) => {
      expect(isCategoryReviewNeededTransaction(transaction)).toBe(false);
      expect(isTransactionTypeReviewNeeded(transaction)).toBe(false);
      expect(isReviewNeededTransaction(transaction)).toBe(false);
    });
  });
});
