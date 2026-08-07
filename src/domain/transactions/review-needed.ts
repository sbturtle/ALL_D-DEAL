import type { Transaction } from './transaction';

/**
 * A category can resolve only an expense missing a category. UNKNOWN remains a
 * transaction-type review, so attaching a category must not hide it from review.
 */
export function isCategoryReviewNeededTransaction(
  transaction: Transaction,
): boolean {
  return transaction.type === 'EXPENSE' && transaction.categoryId === undefined;
}

export function isTransactionTypeReviewNeeded(
  transaction: Transaction,
): boolean {
  return transaction.type === 'UNKNOWN';
}

export function isReviewNeededTransaction(transaction: Transaction): boolean {
  return (
    isTransactionTypeReviewNeeded(transaction) ||
    isCategoryReviewNeededTransaction(transaction)
  );
}
