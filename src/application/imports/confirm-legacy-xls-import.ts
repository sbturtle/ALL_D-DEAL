import {
  LEGACY_XLS_IMPORTER_ID,
  LEGACY_XLS_IMPORTER_VERSION,
} from '../../domain/imports/import-batch';
import type { ImportBatch } from '../../domain/imports/import-batch';
import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import type { Transaction } from '../../domain/transactions/transaction';
import { validateTransaction } from '../../domain/transactions/transaction-validation';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';

export type LegacyXlsImportCommitter = Readonly<{
  commitImport: (
    batch: ImportBatch,
    transactions: readonly Transaction[],
  ) => Promise<void>;
}>;

export type LegacyXlsImportConfirmationDependencies = Readonly<{
  committer: LegacyXlsImportCommitter;
  createId: () => string;
  now: () => UtcIsoInstant;
}>;

export type LegacyXlsImportConfirmationResult =
  | Readonly<{
      isConfirmed: true;
      batch: ImportBatch;
      transactions: readonly Transaction[];
    }>
  | Readonly<{
      isConfirmed: false;
      code: 'nothing_to_save' | 'invalid_generated_transaction' | 'storage_failed';
    }>;

export async function confirmLegacyXlsImport(
  preview: ImportPreview,
  dependencies: LegacyXlsImportConfirmationDependencies,
): Promise<LegacyXlsImportConfirmationResult> {
  if (preview.source === undefined || preview.candidates.length === 0) {
    return { isConfirmed: false, code: 'nothing_to_save' };
  }

  const batchId = dependencies.createId();
  const committedAt = dependencies.now();
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
    skippedCount: 0,
    reviewedCount: transactions.length,
  };

  try {
    await dependencies.committer.commitImport(batch, transactions);
  } catch {
    return { isConfirmed: false, code: 'storage_failed' };
  }

  return { isConfirmed: true, batch, transactions };
}
