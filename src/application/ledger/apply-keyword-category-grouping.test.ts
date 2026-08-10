import { describe, expect, it, vi } from 'vitest';

import type { Transaction } from '../../domain/transactions/transaction';
import {
  applyKeywordCategoryGrouping,
  type KeywordCategoryGroupingRepository,
} from './apply-keyword-category-grouping';

const updatedAt = '2026-08-07T01:00:00.000Z' as const;

const uncategorizedCouponOrder: Transaction = {
  id: '550e8400-e29b-41d4-a716-446655440101',
  occurredOn: '2026-08-01',
  amountMinor: 12_000,
  currency: 'KRW',
  direction: 'OUTFLOW',
  type: 'EXPENSE',
  budgetBucketId: 'LIVING',
  descriptionOriginal: 'Fabricated 쿠팡 오더',
  paymentInstrumentLabel: 'Fabricated card',
  memo: 'Fabricated original memo',
  importBatchId: '550e8400-e29b-41d4-a716-446655440100',
  importerId: 'LEGACY_XLS',
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function createRepository(
  transactions: readonly Transaction[],
): KeywordCategoryGroupingRepository & {
  saveKeywordCategoryRuleAndReplaceTransactions: ReturnType<typeof vi.fn>;
} {
  return {
    listAllTransactions: async () => transactions,
    saveKeywordCategoryRuleAndReplaceTransactions: vi.fn(async () => undefined),
  };
}

describe('applyKeywordCategoryGrouping', () => {
  it('groups only uncategorized matching expenses and preserves all other transaction fields', async () => {
    const categorizedMatch: Transaction = {
      ...uncategorizedCouponOrder,
      id: '550e8400-e29b-41d4-a716-446655440102',
      categoryId: 'FOOD_DINING',
    };
    const matchingIncome: Transaction = {
      ...uncategorizedCouponOrder,
      id: '550e8400-e29b-41d4-a716-446655440103',
      direction: 'INFLOW',
      type: 'INCOME',
    };
    const nonMatchingExpense: Transaction = {
      ...uncategorizedCouponOrder,
      id: '550e8400-e29b-41d4-a716-446655440104',
      descriptionOriginal: 'Fabricated cafe',
    };
    const repository = createRepository([
      uncategorizedCouponOrder,
      categorizedMatch,
      matchingIncome,
      nonMatchingExpense,
    ]);

    const result = await applyKeywordCategoryGrouping(
      { keyword: '쿠팡', categoryId: 'SHOPPING', updatedAt },
      repository,
    );

    expect(result).toEqual({
      isApplied: true,
      keywordCategoryRule: {
        keywordNormalized: '쿠팡',
        categoryId: 'SHOPPING',
        createdAt: updatedAt,
        updatedAt,
      },
      transactions: [
        expect.objectContaining({
          id: uncategorizedCouponOrder.id,
          categoryId: 'SHOPPING',
          amountMinor: uncategorizedCouponOrder.amountMinor,
          occurredOn: uncategorizedCouponOrder.occurredOn,
          direction: uncategorizedCouponOrder.direction,
          type: uncategorizedCouponOrder.type,
          memo: uncategorizedCouponOrder.memo,
          paymentInstrumentLabel: uncategorizedCouponOrder.paymentInstrumentLabel,
          importBatchId: uncategorizedCouponOrder.importBatchId,
          importerId: uncategorizedCouponOrder.importerId,
          createdAt: uncategorizedCouponOrder.createdAt,
          updatedAt,
        }),
      ],
    });
    expect(
      repository.saveKeywordCategoryRuleAndReplaceTransactions,
    ).toHaveBeenCalledWith(
      expect.objectContaining({ keywordNormalized: '쿠팡', categoryId: 'SHOPPING' }),
      [expect.objectContaining({ id: uncategorizedCouponOrder.id })],
    );
  });

  it('does not store a rule for invalid or non-matching keywords', async () => {
    const repository = createRepository([uncategorizedCouponOrder]);

    await expect(
      applyKeywordCategoryGrouping(
        { keyword: 'A', categoryId: 'SHOPPING', updatedAt },
        repository,
      ),
    ).resolves.toEqual({ isApplied: false, code: 'invalid_keyword' });
    await expect(
      applyKeywordCategoryGrouping(
        { keyword: '네이버페이', categoryId: 'SHOPPING', updatedAt },
        repository,
      ),
    ).resolves.toEqual({ isApplied: false, code: 'no_matching_transactions' });
    expect(
      repository.saveKeywordCategoryRuleAndReplaceTransactions,
    ).not.toHaveBeenCalled();
  });

  it('keeps the transaction and rule unchanged when local storage fails', async () => {
    const repository = createRepository([uncategorizedCouponOrder]);
    repository.saveKeywordCategoryRuleAndReplaceTransactions.mockRejectedValueOnce(
      new Error('fabricated storage failure'),
    );

    await expect(
      applyKeywordCategoryGrouping(
        { keyword: '쿠팡', categoryId: 'SHOPPING', updatedAt },
        repository,
      ),
    ).resolves.toEqual({ isApplied: false, code: 'storage_failed' });
  });
});
