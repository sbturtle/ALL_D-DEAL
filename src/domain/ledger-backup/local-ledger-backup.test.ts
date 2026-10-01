import { describe, expect, it } from 'vitest';

import { DEFAULT_BUDGET_BUCKETS } from '../budget-buckets/budget-bucket';
import type { CategoryRule } from '../categories/category-rule';
import type { CustomCategory } from '../categories/custom-category';
import type { KeywordCategoryRule } from '../categories/keyword-category-rule';
import type { ImportBatch } from '../imports/import-batch';
import type { LocalUserSettings } from '../settings/local-user-settings';
import type { Transaction } from '../transactions/transaction';
import type { TransactionAttachment } from '../transactions/transaction-attachment';
import {
  createLocalLedgerBackup,
  validateLocalLedgerBackup,
  type LocalLedgerSnapshot,
} from './local-ledger-backup';

const batch: ImportBatch = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  importerId: 'LEGACY_XLS',
  importerVersion: 1,
  sourceType: 'ACCOUNT_LEDGER_XLS',
  committedAt: '2026-08-31T00:00:00.000Z',
  newCount: 2,
  skippedCount: 0,
  reviewedCount: 2,
};

const customCategory: CustomCategory = {
  id: 'CUSTOM_550e8400-e29b-41d4-a716-446655440010',
  name: '반려동물',
  emoji: '🐾',
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-08-31T00:00:00.000Z',
};

const transactions: readonly Transaction[] = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    occurredOn: '2026-08-30',
    amountMinor: 12_000,
    currency: 'KRW',
    direction: 'OUTFLOW',
    type: 'EXPENSE',
    categoryId: customCategory.id,
    budgetBucketId: 'LIVING',
    descriptionOriginal: '가짜 반려동물 용품점',
    importBatchId: batch.id,
    importerId: 'LEGACY_XLS',
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    occurredOn: '2026-08-30',
    amountMinor: 6_000,
    currency: 'KRW',
    direction: 'INFLOW',
    type: 'INCOME',
    budgetBucketId: 'LIVING',
    descriptionOriginal: '가짜 정산 입금',
    importBatchId: batch.id,
    importerId: 'LEGACY_XLS',
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z',
  },
];

const snapshot: LocalLedgerSnapshot = {
  transactions,
  importBatches: [batch],
  budgetSettlements: [
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      outflowTransactionIds: [transactions[0].id],
      inflowTransactionIds: [transactions[1].id],
      budgetBucketId: 'LIVING',
      createdAt: '2026-08-31T00:00:00.000Z',
      updatedAt: '2026-08-31T00:00:00.000Z',
    },
  ],
  categoryRules: [
    {
      matchDescriptionNormalized: '가짜 반려동물 용품점',
      categoryId: customCategory.id,
      createdAt: '2026-08-31T00:00:00.000Z',
      updatedAt: '2026-08-31T00:00:00.000Z',
    } satisfies CategoryRule,
  ],
  keywordCategoryRules: [
    {
      keywordNormalized: '반려동물',
      categoryId: customCategory.id,
      createdAt: '2026-08-31T00:00:00.000Z',
      updatedAt: '2026-08-31T00:00:00.000Z',
    } satisfies KeywordCategoryRule,
  ],
  userSettings: {
    id: 'current',
    monthlyLivingExpenseGoalMinor: 300_000,
    updatedAt: '2026-08-31T00:00:00.000Z',
  } satisfies LocalUserSettings,
  budgetBuckets: DEFAULT_BUDGET_BUCKETS,
  customCategories: [customCategory],
  transactionAttachments: [
    {
      transactionId: transactions[0].id,
      dataUrl: 'data:image/png;base64,ZmFrZQ==',
      fileName: 'receipt.png',
      mimeType: 'image/png',
      sizeBytes: 5,
      updatedAt: '2026-08-31T00:00:00.000Z',
    } satisfies TransactionAttachment,
  ],
};

describe('local ledger backup', () => {
  it('creates a versioned backup that validates with every persisted store', () => {
    const backup = createLocalLedgerBackup(
      snapshot,
      '2026-08-31T01:00:00.000Z',
    );

    expect(backup).toMatchObject({
      format: 'ALL_D_DEAL_LOCAL_LEDGER',
      version: 1,
      exportedAt: '2026-08-31T01:00:00.000Z',
      data: snapshot,
    });
    expect(validateLocalLedgerBackup(backup)).toEqual({
      isValid: true,
      value: backup,
    });
  });

  it('rejects a backup with an unexpected top-level field', () => {
    const backup = createLocalLedgerBackup(
      snapshot,
      '2026-08-31T01:00:00.000Z',
    );
    const invalidBackup = { ...backup, privateFileName: 'secret.xls' };

    expect(validateLocalLedgerBackup(invalidBackup).isValid).toBe(false);
  });

  it('rejects a backup when a settlement points to a missing transaction', () => {
    const backup = createLocalLedgerBackup(
      snapshot,
      '2026-08-31T01:00:00.000Z',
    );
    const invalidBackup = {
      ...backup,
      data: {
        ...backup.data,
        budgetSettlements: [
          {
            ...backup.data.budgetSettlements[0],
            outflowTransactionIds: [
              '550e8400-e29b-41d4-a716-446655440099',
            ],
          },
        ],
      },
    };

    expect(validateLocalLedgerBackup(invalidBackup).isValid).toBe(false);
  });

  it('rejects a transaction linked by multiple settlements', () => {
    const backup = createLocalLedgerBackup(
      snapshot,
      '2026-08-31T01:00:00.000Z',
    );
    const invalidBackup = {
      ...backup,
      data: {
        ...backup.data,
        budgetSettlements: [
          ...backup.data.budgetSettlements,
          {
            ...backup.data.budgetSettlements[0],
            id: '550e8400-e29b-41d4-a716-446655440004',
          },
        ],
      },
    };

    expect(validateLocalLedgerBackup(invalidBackup).isValid).toBe(false);
  });

  it('rejects a backup when a custom category reference has no definition', () => {
    const backup = createLocalLedgerBackup(
      snapshot,
      '2026-08-31T01:00:00.000Z',
    );
    const invalidBackup = {
      ...backup,
      data: {
        ...backup.data,
        customCategories: [],
      },
    };

    expect(validateLocalLedgerBackup(invalidBackup).isValid).toBe(false);
  });
});
