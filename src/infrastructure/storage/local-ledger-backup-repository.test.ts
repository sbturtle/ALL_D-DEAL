import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import { DEFAULT_BUDGET_BUCKETS } from '../../domain/budget-buckets/budget-bucket';
import type { LocalLedgerSnapshot } from '../../domain/ledger-backup/local-ledger-backup';
import { BrowserLedgerRepository } from './browser-ledger-repository';

const batchId = '550e8400-e29b-41d4-a716-446655440000';
const outflowTransactionId = '550e8400-e29b-41d4-a716-446655440001';
const inflowTransactionId = '550e8400-e29b-41d4-a716-446655440002';

function createRepository(): BrowserLedgerRepository {
  return new BrowserLedgerRepository(
    `backup-test-${crypto.randomUUID()}`,
    new IDBFactory(),
    IDBKeyRange,
  );
}

function createSnapshot(): LocalLedgerSnapshot {
  return {
    transactions: [
      {
        id: outflowTransactionId,
        occurredOn: '2026-08-30',
        amountMinor: 12_000,
        currency: 'KRW',
        direction: 'OUTFLOW',
        type: 'EXPENSE',
        categoryId: 'CUSTOM_550e8400-e29b-41d4-a716-446655440010',
        budgetBucketId: 'LIVING',
        descriptionOriginal: '가짜 반려동물 용품점',
        importBatchId: batchId,
        importerId: 'LEGACY_XLS',
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
      {
        id: inflowTransactionId,
        occurredOn: '2026-08-30',
        amountMinor: 6_000,
        currency: 'KRW',
        direction: 'INFLOW',
        type: 'INCOME',
        budgetBucketId: 'LIVING',
        descriptionOriginal: '가짜 정산 입금',
        importBatchId: batchId,
        importerId: 'LEGACY_XLS',
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
    ],
    importBatches: [
      {
        id: batchId,
        importerId: 'LEGACY_XLS',
        importerVersion: 1,
        sourceType: 'ACCOUNT_LEDGER_XLS',
        committedAt: '2026-08-31T00:00:00.000Z',
        newCount: 2,
        skippedCount: 0,
        reviewedCount: 2,
      },
    ],
    budgetSettlements: [
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        outflowTransactionIds: [outflowTransactionId],
        inflowTransactionIds: [inflowTransactionId],
        budgetBucketId: 'LIVING',
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
    ],
    categoryRules: [
      {
        matchDescriptionNormalized: '가짜 반려동물 용품점',
        categoryId: 'CUSTOM_550e8400-e29b-41d4-a716-446655440010',
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
    ],
    keywordCategoryRules: [
      {
        keywordNormalized: '반려동물',
        categoryId: 'CUSTOM_550e8400-e29b-41d4-a716-446655440010',
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
    ],
    userSettings: {
      id: 'current',
      monthlyLivingExpenseGoalMinor: 300_000,
      updatedAt: '2026-08-31T00:00:00.000Z',
    },
    budgetBuckets: DEFAULT_BUDGET_BUCKETS,
    customCategories: [
      {
        id: 'CUSTOM_550e8400-e29b-41d4-a716-446655440010',
        name: '반려동물',
        emoji: '🐾',
        createdAt: '2026-08-31T00:00:00.000Z',
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
    ],
    transactionAttachments: [
      {
        transactionId: outflowTransactionId,
        dataUrl: 'data:image/png;base64,ZmFrZQ==',
        fileName: 'receipt.png',
        mimeType: 'image/png',
        sizeBytes: 5,
        updatedAt: '2026-08-31T00:00:00.000Z',
      },
    ],
  };
}

describe('BrowserLedgerRepository local backup', () => {
  it('replaces and reads every persisted store as one local snapshot', async () => {
    const repository = createRepository();
    const snapshot = createSnapshot();

    await repository.replaceLocalLedger(snapshot);

    await expect(repository.getLocalLedgerSnapshot()).resolves.toEqual(snapshot);
  });

  it('removes records absent from the replacement snapshot', async () => {
    const repository = createRepository();
    const snapshot = createSnapshot();
    const replacement: LocalLedgerSnapshot = {
      ...snapshot,
      transactions: [snapshot.transactions[1]],
      budgetSettlements: [],
      categoryRules: [],
      keywordCategoryRules: [],
      userSettings: null,
      customCategories: [],
      transactionAttachments: [],
    };

    await repository.replaceLocalLedger(snapshot);
    await repository.replaceLocalLedger(replacement);

    await expect(repository.getLocalLedgerSnapshot()).resolves.toEqual(
      replacement,
    );
  });

  it('rejects an invalid replacement before changing the current snapshot', async () => {
    const repository = createRepository();
    const snapshot = createSnapshot();
    const invalidSnapshot = {
      ...snapshot,
      budgetSettlements: [
        {
          ...snapshot.budgetSettlements[0],
          outflowTransactionIds: [
            '550e8400-e29b-41d4-a716-446655440099',
          ],
        },
      ],
    };

    await repository.replaceLocalLedger(snapshot);

    await expect(repository.replaceLocalLedger(invalidSnapshot)).rejects.toThrow(
      'Local ledger snapshot is invalid.',
    );
    await expect(repository.getLocalLedgerSnapshot()).resolves.toEqual(snapshot);
  });
});
