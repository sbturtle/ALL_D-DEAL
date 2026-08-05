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
        descriptionOriginal: 'Fabricated metro',
      },
    },
  ],
  issues: [],
};

describe('applyCategoryRulesToLegacyXlsPreview', () => {
  it('applies only an exact normalized description rule to the visible Preview', async () => {
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
    });

    expect(result.candidates[0]?.draft.categoryId).toBe('FOOD_DINING');
    expect(result.candidates[1]?.draft.categoryId).toBeUndefined();
    expect(preview.candidates[0]?.draft.categoryId).toBeUndefined();
    expect(listCategoryRules).toHaveBeenCalledOnce();
  });

  it('does not read rules when there is no valid Preview candidate', async () => {
    const listCategoryRules = vi.fn();

    await expect(
      applyCategoryRulesToLegacyXlsPreview(
        { source: undefined, candidates: [], issues: [] },
        { listCategoryRules },
      ),
    ).resolves.toEqual({ source: undefined, candidates: [], issues: [] });
    expect(listCategoryRules).not.toHaveBeenCalled();
  });

  it('does not apply a category rule to non-expense account cash flow', async () => {
    const listCategoryRules = vi.fn();
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
            descriptionOriginal: '가짜 카드 결제',
          },
        },
      ],
      issues: [],
    };

    await expect(
      applyCategoryRulesToLegacyXlsPreview(accountCashFlowPreview, {
        listCategoryRules,
      }),
    ).resolves.toBe(accountCashFlowPreview);
    expect(listCategoryRules).not.toHaveBeenCalled();
  });
});
