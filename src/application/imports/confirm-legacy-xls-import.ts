import {
  LEGACY_XLS_IMPORTER_ID,
  LEGACY_XLS_IMPORTER_VERSION,
} from '../../domain/imports/import-batch';
import {
  createCategoryRule,
  type CategoryRule,
  type CategoryRuleRequest,
} from '../../domain/categories/category-rule';
import type { ImportBatch } from '../../domain/imports/import-batch';
import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import type { Transaction } from '../../domain/transactions/transaction';
import { validateTransaction } from '../../domain/transactions/transaction-validation';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';

export type LegacyXlsImportCommitter = Readonly<{
  commitImport: (
    batch: ImportBatch,
    transactions: readonly Transaction[],
    categoryRules?: readonly CategoryRule[],
  ) => Promise<void>;
}>;

export type LegacyXlsImportConfirmationDependencies = Readonly<{
  committer: LegacyXlsImportCommitter;
  createId: () => string;
  now: () => UtcIsoInstant;
}>;

export type LegacyXlsImportConfirmationOptions = Readonly<{
  skippedCount?: number;
  categoryRuleRequests?: readonly CategoryRuleRequest[];
}>;

export type LegacyXlsImportConfirmationResult =
  | Readonly<{
      isConfirmed: true;
      batch: ImportBatch;
      transactions: readonly Transaction[];
    }>
  | Readonly<{
      isConfirmed: false;
      code:
        | 'nothing_to_save'
        | 'invalid_generated_transaction'
        | 'invalid_category_rule'
        | 'conflicting_category_rule'
        | 'storage_failed';
    }>;

export async function confirmLegacyXlsImport(
  preview: ImportPreview,
  dependencies: LegacyXlsImportConfirmationDependencies,
  options: LegacyXlsImportConfirmationOptions = {},
): Promise<LegacyXlsImportConfirmationResult> {
  if (preview.source === undefined || preview.candidates.length === 0) {
    return { isConfirmed: false, code: 'nothing_to_save' };
  }

  const batchId = dependencies.createId();
  const committedAt = dependencies.now();
  const categoryRuleResult = createConfirmedCategoryRules(
    options.categoryRuleRequests ?? [],
    committedAt,
  );
  if (!categoryRuleResult.isValid) {
    return { isConfirmed: false, code: categoryRuleResult.code };
  }
  const transactions: Transaction[] = [];

  for (const candidate of preview.candidates) {
    const validation = validateTransaction({
      id: dependencies.createId(),
      ...candidate.draft,
      importBatchId: batchId,
      importerId: LEGACY_XLS_IMPORTER_ID,
      createdAt: committedAt,
      updatedAt: committedAt,
    });

    if (!validation.isValid) {
      return { isConfirmed: false, code: 'invalid_generated_transaction' };
    }

    transactions.push(validation.value);
  }

  const batch: ImportBatch = {
    id: batchId,
    importerId: LEGACY_XLS_IMPORTER_ID,
    importerVersion: LEGACY_XLS_IMPORTER_VERSION,
    sourceType: preview.source,
    committedAt,
    newCount: transactions.length,
    skippedCount: getSkippedCount(options.skippedCount),
    reviewedCount: transactions.length + getSkippedCount(options.skippedCount),
  };

  try {
    if (categoryRuleResult.rules.length === 0) {
      await dependencies.committer.commitImport(batch, transactions);
    } else {
      await dependencies.committer.commitImport(
        batch,
        transactions,
        categoryRuleResult.rules,
      );
    }
  } catch {
    return { isConfirmed: false, code: 'storage_failed' };
  }

  return { isConfirmed: true, batch, transactions };
}

function getSkippedCount(value: number | undefined): number {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function createConfirmedCategoryRules(
  requests: readonly CategoryRuleRequest[],
  now: UtcIsoInstant,
):
  | Readonly<{ isValid: true; rules: readonly CategoryRule[] }>
  | Readonly<{
      isValid: false;
      code: 'invalid_category_rule' | 'conflicting_category_rule';
    }> {
  const rulesByDescription = new Map<string, CategoryRule>();

  for (const request of requests) {
    const categoryRule = createCategoryRule(request, now);
    if (categoryRule === null) {
      return { isValid: false, code: 'invalid_category_rule' };
    }

    const previousRule = rulesByDescription.get(
      categoryRule.matchDescriptionNormalized,
    );
    if (
      previousRule !== undefined &&
      previousRule.categoryId !== categoryRule.categoryId
    ) {
      return { isValid: false, code: 'conflicting_category_rule' };
    }

    rulesByDescription.set(categoryRule.matchDescriptionNormalized, categoryRule);
  }

  return { isValid: true, rules: [...rulesByDescription.values()] };
}
