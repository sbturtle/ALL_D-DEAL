import { describe, expect, it, vi } from 'vitest';

import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import type { Transaction } from '../../domain/transactions/transaction';
import { findPotentialLegacyXlsImportDuplicates } from './find-legacy-xls-import-duplicates';

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

const savedTransaction: Transaction = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  ...preview.candidates[0].draft,
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
};

describe('findPotentialLegacyXlsImportDuplicates', () => {
  it('reads saved local transactions and returns only candidate-match metadata', async () => {
    const listAllTransactions = vi.fn().mockResolvedValue([savedTransaction]);

    await expect(
      findPotentialLegacyXlsImportDuplicates(preview, { listAllTransactions }),
    ).resolves.toEqual([
      {
        candidateIndex: 0,
        savedTransactionIds: [savedTransaction.id],
        previewCandidateIndexes: [],
      },
    ]);
    expect(listAllTransactions).toHaveBeenCalledOnce();
  });

  it('does not query storage for an empty Preview', async () => {
    const listAllTransactions = vi.fn();

    await expect(
      findPotentialLegacyXlsImportDuplicates(
        { source: undefined, candidates: [], issues: [] },
        { listAllTransactions },
      ),
    ).resolves.toEqual([]);
    expect(listAllTransactions).not.toHaveBeenCalled();
  });
});
