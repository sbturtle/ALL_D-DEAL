import {
  createLocalLedgerBackup,
  validateLocalLedgerBackup,
  type LocalLedgerBackup,
  type LocalLedgerSnapshot,
} from '../../domain/ledger-backup/local-ledger-backup';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';

export type LocalLedgerBackupRepository = Readonly<{
  getLocalLedgerSnapshot: () => Promise<LocalLedgerSnapshot>;
  replaceLocalLedger: (snapshot: LocalLedgerSnapshot) => Promise<void>;
}>;

export type LocalLedgerBackupSummary = Readonly<{
  transactionCount: number;
  importBatchCount: number;
  settlementCount: number;
  categoryRuleCount: number;
  keywordCategoryRuleCount: number;
  budgetBucketCount: number;
  customCategoryCount: number;
  attachmentCount: number;
  hasUserSettings: boolean;
}>;

export type LocalLedgerBackupParseResult =
  | Readonly<{
      isValid: true;
      backup: LocalLedgerBackup;
      summary: LocalLedgerBackupSummary;
    }>
  | Readonly<{
      isValid: false;
      code: 'invalid_json' | 'invalid_backup';
    }>;

export type LocalLedgerRestoreResult =
  | Readonly<{ isRestored: true }>
  | Readonly<{ isRestored: false; code: 'storage_failed' }>;

export async function exportLocalLedger(
  repository: LocalLedgerBackupRepository,
  exportedAt: UtcIsoInstant,
): Promise<LocalLedgerBackup> {
  const snapshot = await repository.getLocalLedgerSnapshot();
  return createLocalLedgerBackup(snapshot, exportedAt);
}

export function serializeLocalLedgerBackup(
  backup: LocalLedgerBackup,
): string {
  return JSON.stringify(backup, null, 2);
}

function summarizeBackup(backup: LocalLedgerBackup): LocalLedgerBackupSummary {
  const { data } = backup;
  return {
    transactionCount: data.transactions.length,
    importBatchCount: data.importBatches.length,
    settlementCount: data.budgetSettlements.length,
    categoryRuleCount: data.categoryRules.length,
    keywordCategoryRuleCount: data.keywordCategoryRules.length,
    budgetBucketCount: data.budgetBuckets.length,
    customCategoryCount: data.customCategories.length,
    attachmentCount: data.transactionAttachments.length,
    hasUserSettings: data.userSettings !== null,
  };
}

export function parseLocalLedgerBackup(
  text: string,
): LocalLedgerBackupParseResult {
  let candidate: unknown;
  try {
    candidate = JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { isValid: false, code: 'invalid_json' };
    }
    throw error;
  }

  const validation = validateLocalLedgerBackup(candidate);
  if (!validation.isValid) {
    return { isValid: false, code: 'invalid_backup' };
  }

  return {
    isValid: true,
    backup: validation.value,
    summary: summarizeBackup(validation.value),
  };
}

export async function restoreLocalLedger(
  backup: LocalLedgerBackup,
  repository: LocalLedgerBackupRepository,
): Promise<LocalLedgerRestoreResult> {
  try {
    await repository.replaceLocalLedger(backup.data);
    return { isRestored: true };
  } catch (error) {
    if (error instanceof Error) {
      return { isRestored: false, code: 'storage_failed' };
    }
    throw error;
  }
}
