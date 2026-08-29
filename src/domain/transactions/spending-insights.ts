import type { CategoryId } from '../categories/category';
import { normalizeMerchantName } from '../merchants/merchant-normalizer';
import type { Transaction } from './transaction';

export type SpendingInsight = Readonly<{
  categoryId: CategoryId;
  label: string;
  count: number;
  totalAmountMinor: number;
  transactionIds: readonly string[];
}>;

type MutableSpendingInsight = {
  categoryId: CategoryId;
  label: string;
  comparisonKey: string;
  count: number;
  totalAmountMinor: number;
  transactionIds: string[];
};

const MIN_REPEATED_TRANSACTION_COUNT = 2;

function getSpendingLabel(transaction: Transaction): string | undefined {
  const candidate = [
    transaction.merchantNormalized,
    transaction.merchantOriginal,
    transaction.descriptionOriginal,
  ].find((value) => value !== undefined && value.trim().length > 0);

  return candidate === undefined
    ? undefined
    : normalizeMerchantName(candidate).normalized;
}

export function calculateSpendingInsights(
  transactions: readonly Transaction[],
  excludedTransactionIds: ReadonlySet<string> = new Set(),
): readonly SpendingInsight[] {
  const groups = new Map<string, MutableSpendingInsight>();

  for (const transaction of transactions) {
    if (
      excludedTransactionIds.has(transaction.id) ||
      transaction.type !== 'EXPENSE' ||
      transaction.direction !== 'OUTFLOW' ||
      transaction.categoryId === undefined
    ) {
      continue;
    }

    const label = getSpendingLabel(transaction);
    if (label === undefined) {
      continue;
    }

    const comparisonKey = normalizeMerchantName(label).comparisonKey;
    if (comparisonKey.length === 0) {
      continue;
    }

    const key = `${transaction.categoryId}:${comparisonKey}`;
    const current = groups.get(key);
    if (current === undefined) {
      groups.set(key, {
        categoryId: transaction.categoryId,
        label,
        comparisonKey,
        count: 1,
        totalAmountMinor: transaction.amountMinor,
        transactionIds: [transaction.id],
      });
      continue;
    }

    current.count += 1;
    current.totalAmountMinor += transaction.amountMinor;
    current.transactionIds.push(transaction.id);
  }

  return [...groups.values()]
    .filter(({ count }) => count >= MIN_REPEATED_TRANSACTION_COUNT)
    .sort(
      (left, right) =>
        right.count - left.count ||
        right.totalAmountMinor - left.totalAmountMinor ||
        left.categoryId.localeCompare(right.categoryId) ||
        left.comparisonKey.localeCompare(right.comparisonKey),
    )
    .map(({ comparisonKey: ignoredComparisonKey, ...insight }) => {
      void ignoredComparisonKey;
      return insight;
    });
}
