import { DEFAULT_BUDGET_BUCKETS, getDefaultBudgetBucket, validateBudgetBucket } from '../budget-buckets/budget-bucket';
import { validateCategoryRule } from '../categories/category-rule';
import { validateCustomCategory } from '../categories/custom-category';
import { validateKeywordCategoryRule } from '../categories/keyword-category-rule';
import type { ImportBatch } from '../imports/import-batch';
import {
  IMPORT_SOURCES,
  type ImportSource,
} from '../imports/legacy-xls-preview';
import { validateLocalUserSettings } from '../settings/local-user-settings';
import { validateBudgetSettlement } from '../transactions/budget-settlement';
import { validateTransactionAttachment } from '../transactions/transaction-attachment';
import { validateTransaction } from '../transactions/transaction-validation';
import { isUtcIsoInstant } from '../transactions/utc-iso-instant';
import {
  LOCAL_LEDGER_BACKUP_FORMAT,
  LOCAL_LEDGER_BACKUP_VERSION,
  type LocalLedgerBackup,
  type LocalLedgerBackupValidationIssue,
  type LocalLedgerBackupValidationResult,
  type LocalLedgerSnapshot,
  type LocalLedgerSnapshotValidationResult,
  type LocalLedgerValidationResult,
} from './local-ledger-backup-types';
import { hasValidLocalLedgerReferences } from './local-ledger-backup-relations';

type CandidateRecord = Record<string, unknown>;
type Validator<T> = (
  candidate: unknown,
) => LocalLedgerValidationResult<T>;

const BACKUP_FIELDS = ['format', 'version', 'exportedAt', 'data'] as const;
const SNAPSHOT_FIELDS = [
  'transactions',
  'importBatches',
  'budgetSettlements',
  'categoryRules',
  'keywordCategoryRules',
  'userSettings',
  'budgetBuckets',
  'customCategories',
  'transactionAttachments',
] as const;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IMPORTER_ID = 'LEGACY_XLS';
const IMPORTER_VERSION = 1;

function isPlainRecord(value: unknown): value is CandidateRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasUnexpectedField(
  candidate: CandidateRecord,
  fields: readonly string[],
): boolean {
  const fieldSet = new Set(fields);
  return Object.keys(candidate).some((field) => !fieldSet.has(field));
}

function invalid(
  field: string,
  code: LocalLedgerBackupValidationIssue['code'],
): LocalLedgerValidationResult<never> {
  return { isValid: false, issues: [{ field, code }] };
}

function readValidatedArray<T>(
  candidate: unknown,
  validator: Validator<T>,
): readonly T[] | undefined {
  if (!Array.isArray(candidate)) {
    return undefined;
  }

  const values: T[] = [];
  for (const item of candidate) {
    const validation = validator(item);
    if (!validation.isValid) {
      return undefined;
    }
    values.push(validation.value);
  }
  return values;
}

function hasDuplicateKey<T>(
  values: readonly T[],
  getKey: (value: T) => string,
): boolean {
  const keys = new Set<string>();
  for (const value of values) {
    const key = getKey(value);
    if (keys.has(key)) {
      return true;
    }
    keys.add(key);
  }
  return false;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validateImportBatch(
  candidate: unknown,
): LocalLedgerValidationResult<ImportBatch> {
  if (!isPlainRecord(candidate)) {
    return invalid('$record', 'invalid_record');
  }
  if (hasUnexpectedField(candidate, [
    'id',
    'importerId',
    'importerVersion',
    'sourceType',
    'committedAt',
    'newCount',
    'skippedCount',
    'reviewedCount',
  ])) {
    return invalid('$record', 'unexpected_field');
  }

  const sourceType = IMPORT_SOURCES.find((source) => source === candidate.sourceType);
  if (
    typeof candidate.id !== 'string' ||
    !UUID_PATTERN.test(candidate.id) ||
    candidate.importerId !== IMPORTER_ID ||
    candidate.importerVersion !== IMPORTER_VERSION ||
    sourceType === undefined ||
    !isUtcIsoInstant(candidate.committedAt) ||
    !isNonNegativeSafeInteger(candidate.newCount) ||
    !isNonNegativeSafeInteger(candidate.skippedCount) ||
    !isNonNegativeSafeInteger(candidate.reviewedCount)
  ) {
    return invalid('$record', 'invalid_record');
  }

  return {
    isValid: true,
    value: {
      id: candidate.id,
      importerId: IMPORTER_ID,
      importerVersion: IMPORTER_VERSION,
      sourceType: sourceType as ImportSource,
      committedAt: candidate.committedAt,
      newCount: candidate.newCount,
      skippedCount: candidate.skippedCount,
      reviewedCount: candidate.reviewedCount,
    },
  };
}

function validateBudgetBuckets(
  buckets: readonly LocalLedgerSnapshot['budgetBuckets'][number][],
): boolean {
  const byId = new Map(buckets.map((bucket) => [bucket.id, bucket]));
  for (const defaultBucket of DEFAULT_BUDGET_BUCKETS) {
    const bucket = byId.get(defaultBucket.id);
    if (bucket === undefined || !bucket.isDefault || bucket.isArchived) {
      return false;
    }
  }
  return buckets.every((bucket) => {
    const defaultBucket = getDefaultBudgetBucket(bucket.id);
    return defaultBucket === undefined ? !bucket.isDefault : bucket.isDefault;
  });
}

function validateSnapshotRecords(
  candidate: CandidateRecord,
): LocalLedgerSnapshotValidationResult {
  const transactions = readValidatedArray(candidate.transactions, (value) => {
    const validation = validateTransaction(value);
    return validation.isValid ? validation : invalid('$record', 'invalid_record');
  });
  const importBatches = readValidatedArray(candidate.importBatches, validateImportBatch);
  const budgetSettlements = readValidatedArray(candidate.budgetSettlements, (value) => {
    const validation = validateBudgetSettlement(value);
    return validation.isValid ? validation : invalid('$record', 'invalid_record');
  });
  const categoryRules = readValidatedArray(candidate.categoryRules, (value) => {
    const validation = validateCategoryRule(value);
    return validation.isValid ? validation : invalid('$record', 'invalid_record');
  });
  const keywordCategoryRules = readValidatedArray(
    candidate.keywordCategoryRules,
    (value) => {
      const validation = validateKeywordCategoryRule(value);
      return validation.isValid
        ? validation
        : invalid('$record', 'invalid_record');
    },
  );
  const budgetBuckets = readValidatedArray(candidate.budgetBuckets, (value) => {
    const validation = validateBudgetBucket(value);
    return validation.isValid ? validation : invalid('$record', 'invalid_record');
  });
  const customCategories = readValidatedArray(candidate.customCategories, (value) => {
    const validation = validateCustomCategory(value);
    return validation.isValid ? validation : invalid('$record', 'invalid_record');
  });
  const transactionAttachments = readValidatedArray(
    candidate.transactionAttachments,
    (value) => {
      const validation = validateTransactionAttachment(value);
      return validation.isValid
        ? validation
        : invalid('$record', 'invalid_record');
    },
  );
  const userSettingsValidation =
    candidate.userSettings === null
      ? { isValid: true as const, value: null }
      : validateLocalUserSettings(candidate.userSettings);

  if (
    transactions === undefined ||
    importBatches === undefined ||
    budgetSettlements === undefined ||
    categoryRules === undefined ||
    keywordCategoryRules === undefined ||
    budgetBuckets === undefined ||
    customCategories === undefined ||
    transactionAttachments === undefined ||
    !userSettingsValidation.isValid
  ) {
    return invalid('data', 'invalid_data');
  }

  const snapshot: LocalLedgerSnapshot = {
    transactions,
    importBatches,
    budgetSettlements,
    categoryRules,
    keywordCategoryRules,
    userSettings: userSettingsValidation.value,
    budgetBuckets,
    customCategories,
    transactionAttachments,
  };

  if (
    hasDuplicateKey(snapshot.transactions, (value) => value.id) ||
    hasDuplicateKey(snapshot.importBatches, (value) => value.id) ||
    hasDuplicateKey(snapshot.budgetSettlements, (value) => value.id) ||
    hasDuplicateKey(snapshot.categoryRules, (value) => value.matchDescriptionNormalized) ||
    hasDuplicateKey(snapshot.keywordCategoryRules, (value) => value.keywordNormalized) ||
    hasDuplicateKey(snapshot.budgetBuckets, (value) => value.id) ||
    hasDuplicateKey(snapshot.customCategories, (value) => value.id) ||
    hasDuplicateKey(snapshot.transactionAttachments, (value) => value.transactionId) ||
    !validateBudgetBuckets(snapshot.budgetBuckets) ||
    !hasValidLocalLedgerReferences(snapshot)
  ) {
    return invalid('data', 'invalid_relationship');
  }

  return { isValid: true, value: snapshot };
}

export function validateLocalLedgerSnapshot(
  candidate: unknown,
): LocalLedgerSnapshotValidationResult {
  if (!isPlainRecord(candidate)) {
    return invalid('$root', 'invalid_root');
  }
  if (hasUnexpectedField(candidate, SNAPSHOT_FIELDS)) {
    return invalid('$root', 'unexpected_field');
  }
  return validateSnapshotRecords(candidate);
}

export function validateLocalLedgerBackup(
  candidate: unknown,
): LocalLedgerBackupValidationResult {
  if (!isPlainRecord(candidate)) {
    return invalid('$root', 'invalid_root');
  }
  if (hasUnexpectedField(candidate, BACKUP_FIELDS)) {
    return invalid('$root', 'unexpected_field');
  }
  if (candidate.format !== LOCAL_LEDGER_BACKUP_FORMAT) {
    return invalid('format', 'invalid_format');
  }
  if (candidate.version !== LOCAL_LEDGER_BACKUP_VERSION) {
    return invalid('version', 'unsupported_version');
  }
  if (!isUtcIsoInstant(candidate.exportedAt)) {
    return invalid('exportedAt', 'invalid_exported_at');
  }

  const data = validateLocalLedgerSnapshot(candidate.data);
  if (!data.isValid) {
    return data;
  }

  const backup: LocalLedgerBackup = {
    format: LOCAL_LEDGER_BACKUP_FORMAT,
    version: LOCAL_LEDGER_BACKUP_VERSION,
    exportedAt: candidate.exportedAt,
    data: data.value,
  };
  return { isValid: true, value: backup };
}
