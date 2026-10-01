import type { BudgetBucket } from '../budget-buckets/budget-bucket';
import type { CategoryRule } from '../categories/category-rule';
import type { CustomCategory } from '../categories/custom-category';
import type { KeywordCategoryRule } from '../categories/keyword-category-rule';
import type { ImportBatch } from '../imports/import-batch';
import type { LocalUserSettings } from '../settings/local-user-settings';
import type { BudgetSettlement } from '../transactions/budget-settlement';
import type { TransactionAttachment } from '../transactions/transaction-attachment';
import type { Transaction } from '../transactions/transaction';
import type { UtcIsoInstant } from '../transactions/utc-iso-instant';

export const LOCAL_LEDGER_BACKUP_FORMAT = 'ALL_D_DEAL_LOCAL_LEDGER' as const;
export const LOCAL_LEDGER_BACKUP_VERSION = 1 as const;

export type LocalLedgerSnapshot = Readonly<{
  transactions: readonly Transaction[];
  importBatches: readonly ImportBatch[];
  budgetSettlements: readonly BudgetSettlement[];
  categoryRules: readonly CategoryRule[];
  keywordCategoryRules: readonly KeywordCategoryRule[];
  userSettings: LocalUserSettings | null;
  budgetBuckets: readonly BudgetBucket[];
  customCategories: readonly CustomCategory[];
  transactionAttachments: readonly TransactionAttachment[];
}>;

export type LocalLedgerBackup = Readonly<{
  format: typeof LOCAL_LEDGER_BACKUP_FORMAT;
  version: typeof LOCAL_LEDGER_BACKUP_VERSION;
  exportedAt: UtcIsoInstant;
  data: LocalLedgerSnapshot;
}>;

export type LocalLedgerBackupValidationIssue = Readonly<{
  field: string;
  code:
    | 'invalid_root'
    | 'unexpected_field'
    | 'invalid_format'
    | 'unsupported_version'
    | 'invalid_exported_at'
    | 'invalid_data'
    | 'invalid_record'
    | 'duplicate_key'
    | 'missing_reference'
    | 'invalid_relationship';
}>;

export type LocalLedgerValidationResult<T> =
  | Readonly<{ isValid: true; value: T }>
  | Readonly<{
      isValid: false;
      issues: readonly LocalLedgerBackupValidationIssue[];
    }>;

export type LocalLedgerBackupValidationResult =
  LocalLedgerValidationResult<LocalLedgerBackup>;

export type LocalLedgerSnapshotValidationResult =
  LocalLedgerValidationResult<LocalLedgerSnapshot>;
