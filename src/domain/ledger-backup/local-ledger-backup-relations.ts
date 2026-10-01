import { isCustomCategoryId } from '../categories/category';
import type { LocalLedgerSnapshot } from './local-ledger-backup-types';

function hasKnownCategory(
  categoryId: string | undefined,
  customCategoryIds: ReadonlySet<string>,
): boolean {
  return categoryId === undefined || !isCustomCategoryId(categoryId)
    ? true
    : customCategoryIds.has(categoryId);
}

export function hasValidLocalLedgerReferences(
  snapshot: LocalLedgerSnapshot,
): boolean {
  const transactionById = new Map(
    snapshot.transactions.map((transaction) => [transaction.id, transaction]),
  );
  const importBatchIds = new Set(
    snapshot.importBatches.map((importBatch) => importBatch.id),
  );
  const budgetBucketIds = new Set(
    snapshot.budgetBuckets.map((budgetBucket) => budgetBucket.id),
  );
  const customCategoryIds = new Set(
    snapshot.customCategories.map((category) => category.id),
  );
  const linkedTransactionIds = new Set<string>();

  for (const transaction of snapshot.transactions) {
    if (
      (transaction.importBatchId !== undefined &&
        !importBatchIds.has(transaction.importBatchId)) ||
      !budgetBucketIds.has(transaction.budgetBucketId) ||
      !hasKnownCategory(transaction.categoryId, customCategoryIds)
    ) {
      return false;
    }
  }

  for (const settlement of snapshot.budgetSettlements) {
    if (!budgetBucketIds.has(settlement.budgetBucketId)) {
      return false;
    }

    const participantIds = [
      ...settlement.outflowTransactionIds,
      ...settlement.inflowTransactionIds,
    ];
    if (participantIds.some((transactionId) => linkedTransactionIds.has(transactionId))) {
      return false;
    }
    for (const transactionId of participantIds) {
      linkedTransactionIds.add(transactionId);
    }

    for (const transactionId of settlement.outflowTransactionIds) {
      const transaction = transactionById.get(transactionId);
      if (transaction === undefined || transaction.direction !== 'OUTFLOW') {
        return false;
      }
    }
    for (const transactionId of settlement.inflowTransactionIds) {
      const transaction = transactionById.get(transactionId);
      if (transaction === undefined || transaction.direction !== 'INFLOW') {
        return false;
      }
    }
  }

  for (const rule of snapshot.categoryRules) {
    if (!hasKnownCategory(rule.categoryId, customCategoryIds)) {
      return false;
    }
  }
  for (const rule of snapshot.keywordCategoryRules) {
    if (!hasKnownCategory(rule.categoryId, customCategoryIds)) {
      return false;
    }
  }
  for (const attachment of snapshot.transactionAttachments) {
    if (!transactionById.has(attachment.transactionId)) {
      return false;
    }
  }

  return true;
}
