import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_BUDGET_BUCKETS } from '../../domain/budget-buckets/budget-bucket';
import {
  createLocalLedgerBackup,
  type LocalLedgerSnapshot,
} from '../../domain/ledger-backup/local-ledger-backup';
import {
  exportLocalLedger,
  parseLocalLedgerBackup,
  restoreLocalLedger,
  serializeLocalLedgerBackup,
  type LocalLedgerBackupRepository,
} from './manage-local-ledger-backup';

const emptySnapshot: LocalLedgerSnapshot = {
  transactions: [],
  importBatches: [],
  budgetSettlements: [],
  categoryRules: [],
  keywordCategoryRules: [],
  userSettings: null,
  budgetBuckets: DEFAULT_BUDGET_BUCKETS,
  customCategories: [],
  transactionAttachments: [],
};

describe('manage local ledger backup', () => {
  it('exports the current snapshot and serializes a readable JSON document', async () => {
    const repository: LocalLedgerBackupRepository = {
      getLocalLedgerSnapshot: vi.fn().mockResolvedValue(emptySnapshot),
      replaceLocalLedger: vi.fn(),
    };

    const backup = await exportLocalLedger(
      repository,
      '2026-08-31T01:00:00.000Z',
    );
    const parsed = JSON.parse(serializeLocalLedgerBackup(backup)) as unknown;

    expect(repository.getLocalLedgerSnapshot).toHaveBeenCalledOnce();
    expect(parsed).toEqual(backup);
  });

  it('parses a backup and returns counts for the confirmation view', () => {
    const backup = createLocalLedgerBackup(
      emptySnapshot,
      '2026-08-31T01:00:00.000Z',
    );

    expect(parseLocalLedgerBackup(JSON.stringify(backup))).toEqual({
      isValid: true,
      backup,
      summary: {
        transactionCount: 0,
        importBatchCount: 0,
        settlementCount: 0,
        categoryRuleCount: 0,
        keywordCategoryRuleCount: 0,
        budgetBucketCount: 7,
        customCategoryCount: 0,
        attachmentCount: 0,
        hasUserSettings: false,
      },
    });
  });

  it('returns a safe error result for malformed JSON', () => {
    expect(parseLocalLedgerBackup('{not-json')).toEqual({
      isValid: false,
      code: 'invalid_json',
    });
  });

  it('reports storage failure without hiding the failed restore', async () => {
    const backup = createLocalLedgerBackup(
      emptySnapshot,
      '2026-08-31T01:00:00.000Z',
    );
    const repository: LocalLedgerBackupRepository = {
      getLocalLedgerSnapshot: vi.fn(),
      replaceLocalLedger: vi.fn().mockRejectedValue(new Error('disk failed')),
    };

    await expect(restoreLocalLedger(backup, repository)).resolves.toEqual({
      isRestored: false,
      code: 'storage_failed',
    });
  });
});
