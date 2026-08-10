import { describe, expect, it, vi } from 'vitest';

import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import { confirmLegacyXlsImport } from './confirm-legacy-xls-import';

const preview: ImportPreview = {
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
        type: 'UNKNOWN',
        budgetBucketId: 'LIVING',
        descriptionOriginal: 'Fabricated account transaction',
      },
    },
  ],
  issues: [],
};

const ids = [
  '550e8400-e29b-41d4-a716-446655440000',
  '550e8400-e29b-41d4-a716-446655440001',
];

describe('confirmLegacyXlsImport', () => {
  it('builds complete source-traceable transactions and commits them once', async () => {
    const commitImport = vi.fn().mockResolvedValue(undefined);
    const createId = vi.fn(() => ids.shift() ?? '550e8400-e29b-41d4-a716-446655440002');

    const result = await confirmLegacyXlsImport(preview, {
      committer: { commitImport },
      createId,
      now: () => '2026-08-05T00:00:00.000Z',
    });

    expect(result).toEqual(
      expect.objectContaining({
        isConfirmed: true,
        batch: expect.objectContaining({
          sourceType: 'ACCOUNT_LEDGER_XLS',
          newCount: 1,
        }),
      }),
    );
    expect(commitImport).toHaveBeenCalledTimes(1);
    expect(commitImport).toHaveBeenCalledWith(
      expect.objectContaining({ id: '550e8400-e29b-41d4-a716-446655440000' }),
      [
        expect.objectContaining({
          id: '550e8400-e29b-41d4-a716-446655440001',
          importBatchId: '550e8400-e29b-41d4-a716-446655440000',
          importerId: 'LEGACY_XLS',
          budgetBucketId: 'LIVING',
        }),
      ],
    );
  });

  it('persists the classified type without Preview-only classification metadata', async () => {
    const commitImport = vi.fn().mockResolvedValue(undefined);
    const createId = (() => {
      let index = 0;
      return () => ids[index++] ?? '550e8400-e29b-41d4-a716-446655440002';
    })();
    const classifiedPreview: ImportPreview = {
      ...preview,
      candidates: [
        {
          ...preview.candidates[0]!,
          accountTypeClassification: {
            type: 'CARD_PAYMENT',
            source: 'ACCOUNT_RULE_ENGINE',
            reasonCode: 'card_payment_keyword',
            confidence: 'HIGH',
          },
          draft: {
            ...preview.candidates[0]!.draft,
            type: 'CARD_PAYMENT',
          },
        },
      ],
    };

    const result = await confirmLegacyXlsImport(classifiedPreview, {
      committer: { commitImport },
      createId,
      now: () => '2026-08-05T00:00:00.000Z',
    });

    expect(result).toMatchObject({
      isConfirmed: true,
      transactions: [expect.objectContaining({ type: 'CARD_PAYMENT' })],
    });
    expect(commitImport.mock.calls[0]?.[1]?.[0]).not.toHaveProperty(
      'accountTypeClassification',
    );
  });

  it('does not attempt storage when there is no supported candidate', async () => {
    const commitImport = vi.fn();
    const result = await confirmLegacyXlsImport(
      { source: undefined, candidates: [], issues: [] },
      {
        committer: { commitImport },
        createId: () => ids[0],
        now: () => '2026-08-05T00:00:00.000Z',
      },
    );

    expect(result).toEqual({ isConfirmed: false, code: 'nothing_to_save' });
    expect(commitImport).not.toHaveBeenCalled();
  });

  it('records deliberately excluded candidates without changing selected transactions', async () => {
    const commitImport = vi.fn().mockResolvedValue(undefined);
    const createId = (() => {
      let index = 0;
      return () => ids[index++] ?? '550e8400-e29b-41d4-a716-446655440002';
    })();

    const result = await confirmLegacyXlsImport(
      preview,
      {
        committer: { commitImport },
        createId,
        now: () => '2026-08-05T00:00:00.000Z',
      },
      { skippedCount: 2 },
    );

    expect(result).toEqual(
      expect.objectContaining({
        isConfirmed: true,
        batch: expect.objectContaining({
          newCount: 1,
          skippedCount: 2,
          reviewedCount: 3,
        }),
      }),
    );
    expect(commitImport).toHaveBeenCalledWith(
      expect.objectContaining({ skippedCount: 2, reviewedCount: 3 }),
      [expect.objectContaining({ descriptionOriginal: 'Fabricated account transaction' })],
    );
  });

  it('commits a user-confirmed category rule with the selected import', async () => {
    const commitImport = vi.fn().mockResolvedValue(undefined);
    const createId = (() => {
      let index = 0;
      return () => ids[index++] ?? '550e8400-e29b-41d4-a716-446655440002';
    })();

    const result = await confirmLegacyXlsImport(
      preview,
      {
        committer: { commitImport },
        createId,
        now: () => '2026-08-05T00:00:00.000Z',
      },
      {
        categoryRuleRequests: [
          {
            descriptionOriginal: 'Fabricated account transaction',
            categoryId: 'OTHER',
          },
        ],
      },
    );

    expect(result.isConfirmed).toBe(true);
    expect(commitImport).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      [
        {
          matchDescriptionNormalized: 'fabricated account transaction',
          categoryId: 'OTHER',
          createdAt: '2026-08-05T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
        },
      ],
    );
  });

  it('does not commit conflicting categories for the same normalized description', async () => {
    const commitImport = vi.fn();

    await expect(
      confirmLegacyXlsImport(
        preview,
        {
          committer: { commitImport },
          createId: () => ids[0],
          now: () => '2026-08-05T00:00:00.000Z',
        },
        {
          categoryRuleRequests: [
            { descriptionOriginal: 'Fabricated cafe', categoryId: 'FOOD_DINING' },
            { descriptionOriginal: 'fabricated cafe!', categoryId: 'LEISURE' },
          ],
        },
      ),
    ).resolves.toEqual({ isConfirmed: false, code: 'conflicting_category_rule' });
    expect(commitImport).not.toHaveBeenCalled();
  });

  it('returns a safe failure when the local committer fails', async () => {
    const result = await confirmLegacyXlsImport(preview, {
      committer: { commitImport: vi.fn().mockRejectedValue(new Error('private detail')) },
      createId: (() => {
        let index = 0;
        return () => ids[index++] ?? '550e8400-e29b-41d4-a716-446655440002';
      })(),
      now: () => '2026-08-05T00:00:00.000Z',
    });

    expect(result).toEqual({ isConfirmed: false, code: 'storage_failed' });
    expect(JSON.stringify(result)).not.toContain('private detail');
  });
});
