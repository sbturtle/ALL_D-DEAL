import { describe, expect, it, vi } from 'vitest';

import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import { applyCategoryRulesToLegacyXlsPreview } from './apply-category-rules-to-legacy-xls-preview';

const preview: ImportPreview = {
  source: 'CARD_USAGE_XLS',
  candidates: [
    {
      source: 'CARD_USAGE_XLS',
      rowNumber: 5,
      draft: {
        occurredOn: '2026-08-05',
        amountMinor: 42_000,
        currency: 'KRW',
        direction: 'OUTFLOW',
        type: 'EXPENSE',
        budgetBucketId: 'LIVING',
        descriptionOriginal: 'Fabricated Cafe — Seoul!',
      },
    },
    {
      source: 'CARD_USAGE_XLS',
      rowNumber: 6,
      draft: {
        occurredOn: '2026-08-05',
        amountMinor: 20_000,
        currency: 'KRW',
        direction: 'OUTFLOW',
        type: 'EXPENSE',
        budgetBucketId: 'LIVING',
        descriptionOriginal: 'Fabricated metro',
      },
    },
  ],
  issues: [],
};

describe('applyCategoryRulesToLegacyXlsPreview', () => {
  it('applies an exact normalized description rule before keyword rules', async () => {
    const listCategoryRules = vi.fn().mockResolvedValue([
      {
        matchDescriptionNormalized: 'fabricated cafe seoul',
        categoryId: 'FOOD_DINING',
        createdAt: '2026-08-05T00:00:00.000Z',
        updatedAt: '2026-08-05T00:00:00.000Z',
      },
    ]);

    const result = await applyCategoryRulesToLegacyXlsPreview(preview, {
      listCategoryRules,
      listKeywordCategoryRules: async () => [
        {
          keywordNormalized: 'fabricatedcafe',
          categoryId: 'SHOPPING',
          createdAt: '2026-08-07T00:00:00.000Z',
          updatedAt: '2026-08-07T00:00:00.000Z',
        },
      ],
    });

    expect(result.candidates[0]?.draft.categoryId).toBe('FOOD_DINING');
    expect(result.candidates[1]?.draft.categoryId).toBeUndefined();
    expect(preview.candidates[0]?.draft.categoryId).toBeUndefined();
    expect(listCategoryRules).toHaveBeenCalledOnce();
  });

  it('does not read rules when there is no valid Preview candidate', async () => {
    const listCategoryRules = vi.fn();
    const listKeywordCategoryRules = vi.fn();

    await expect(
      applyCategoryRulesToLegacyXlsPreview(
        { source: undefined, candidates: [], issues: [] },
        { listCategoryRules, listKeywordCategoryRules },
      ),
    ).resolves.toEqual({ source: undefined, candidates: [], issues: [] });
    expect(listCategoryRules).not.toHaveBeenCalled();
    expect(listKeywordCategoryRules).not.toHaveBeenCalled();
  });

  it('does not apply a category rule to non-expense account cash flow', async () => {
    const listCategoryRules = vi.fn();
    const listKeywordCategoryRules = vi.fn();
    const accountCashFlowPreview: ImportPreview = {
      source: 'ACCOUNT_LEDGER_XLS',
      candidates: [
        {
          source: 'ACCOUNT_LEDGER_XLS',
          rowNumber: 5,
          draft: {
            occurredOn: '2026-08-05',
            amountMinor: 42_000,
            currency: 'KRW',
            direction: 'OUTFLOW',
            type: 'CARD_PAYMENT',
            budgetBucketId: 'LIVING',
            descriptionOriginal: '가짜 카드 결제',
          },
        },
      ],
      issues: [],
    };

    await expect(
      applyCategoryRulesToLegacyXlsPreview(accountCashFlowPreview, {
        listCategoryRules,
        listKeywordCategoryRules,
      }),
    ).resolves.toBe(accountCashFlowPreview);
    expect(listCategoryRules).not.toHaveBeenCalled();
    expect(listKeywordCategoryRules).not.toHaveBeenCalled();
  });

  it('applies the longest matching user-confirmed keyword to unresolved expenses', async () => {
    const keywordPreview: ImportPreview = {
      ...preview,
      candidates: [
        {
          ...preview.candidates[0]!,
          draft: {
            ...preview.candidates[0]!.draft,
            descriptionOriginal: 'Fabricated 쿠팡이츠 오더',
          },
        },
      ],
    };

    const result = await applyCategoryRulesToLegacyXlsPreview(keywordPreview, {
      listCategoryRules: async () => [],
      listKeywordCategoryRules: async () => [
        {
          keywordNormalized: '쿠팡',
          categoryId: 'SHOPPING',
          createdAt: '2026-08-07T00:00:00.000Z',
          updatedAt: '2026-08-07T00:00:00.000Z',
        },
        {
          keywordNormalized: '쿠팡이츠',
          categoryId: 'FOOD_DINING',
          createdAt: '2026-08-07T00:00:00.000Z',
          updatedAt: '2026-08-07T00:00:00.000Z',
        },
      ],
    });

    expect(result.candidates[0]?.draft.categoryId).toBe('FOOD_DINING');
  });

  it('fills well-known merchants with a built-in suggestion after user rules', async () => {
    const defaultPreview: ImportPreview = {
      ...preview,
      candidates: [
        {
          ...preview.candidates[0]!,
          draft: {
            ...preview.candidates[0]!.draft,
            descriptionOriginal: '가짜 스타벅스 테스트점',
          },
        },
        {
          ...preview.candidates[1]!,
          draft: {
            ...preview.candidates[1]!.draft,
            descriptionOriginal: '가짜 쿠팡이츠 주문',
          },
        },
        {
          ...preview.candidates[1]!,
          rowNumber: 7,
          draft: {
            ...preview.candidates[1]!.draft,
            descriptionOriginal: 'Fabricated unknown shop',
          },
        },
      ],
    };

    const result = await applyCategoryRulesToLegacyXlsPreview(defaultPreview, {
      listCategoryRules: async () => [],
      listKeywordCategoryRules: async () => [
        {
          keywordNormalized: '쿠팡',
          categoryId: 'SHOPPING',
          createdAt: '2026-08-07T00:00:00.000Z',
          updatedAt: '2026-08-07T00:00:00.000Z',
        },
      ],
    });

    expect(result.candidates[0]?.draft.categoryId).toBe('CAFE');
    expect(result.candidates[0]?.categorySource).toBe('DEFAULT_KEYWORD');
    expect(result.candidates[1]?.draft.categoryId).toBe('SHOPPING');
    expect(result.candidates[1]?.categorySource).toBe('USER_RULE');
    expect(result.candidates[2]?.draft.categoryId).toBeUndefined();
    expect(result.candidates[2]?.categorySource).toBeUndefined();
  });
});
