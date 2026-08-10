import type { BudgetBucketId } from '../budget-buckets/budget-bucket';
import type { BudgetSettlement } from './budget-settlement';
import { isDateInTransactionRange } from './transaction-period';
import type { TransactionDateRange } from './transaction-period';
import type { Transaction } from './transaction';

type BudgetBucketExpenseCandidate = Pick<
  Transaction,
  'direction' | 'type' | 'budgetBucketId'
>;

export function isBudgetBucketExpense(
  transaction: BudgetBucketExpenseCandidate,
  budgetBucketId: BudgetBucketId,
): boolean {
  return (
    transaction.type === 'EXPENSE' &&
    transaction.direction === 'OUTFLOW' &&
    transaction.budgetBucketId === budgetBucketId
  );
}

export function isLivingExpense(
  transaction: BudgetBucketExpenseCandidate,
): boolean {
  return isBudgetBucketExpense(transaction, 'LIVING');
}

export type BudgetBucketExpenseSummary = Readonly<{
  budgetBucketId: BudgetBucketId;
  unlinkedExpenseAmountMinor: number;
  sharedPaymentExpenseAmountMinor: number;
  totalAmountMinor: number;
  sharedPaymentCount: number;
}>;

export type LivingExpenseSummary = Omit<
  BudgetBucketExpenseSummary,
  'budgetBucketId'
>;

export function calculateBudgetBucketExpenseSummary(
  transactions: readonly Transaction[],
  settlements: readonly BudgetSettlement[],
  range: TransactionDateRange,
  budgetBucketId: BudgetBucketId,
): BudgetBucketExpenseSummary {
  const transactionById = new Map(
    transactions.map((transaction) => [transaction.id, transaction]),
  );
  const linkedOutflowIds = new Set(
    settlements.flatMap((settlement) => settlement.outflowTransactionIds),
  );
  let unlinkedExpenseAmountMinor = 0;
  let sharedPaymentExpenseAmountMinor = 0;
  let sharedPaymentCount = 0;

  for (const transaction of transactions) {
    if (
      isDateInTransactionRange(transaction.occurredOn, range) &&
      isBudgetBucketExpense(transaction, budgetBucketId) &&
      !linkedOutflowIds.has(transaction.id)
    ) {
      unlinkedExpenseAmountMinor += transaction.amountMinor;
    }
  }

  for (const settlement of settlements) {
    if (settlement.budgetBucketId !== budgetBucketId) {
      continue;
    }

    const outflowTotal = settlement.outflowTransactionIds.reduce(
      (total, transactionId) => {
        const outflow = transactionById.get(transactionId);
        return outflow?.direction === 'OUTFLOW' &&
          isDateInTransactionRange(outflow.occurredOn, range)
          ? total + outflow.amountMinor
          : total;
      },
      0,
    );
    if (outflowTotal === 0) {
      continue;
    }

    const inflowTotal = settlement.inflowTransactionIds.reduce(
      (total, transactionId) => {
        const inflow = transactionById.get(transactionId);
        return inflow?.direction === 'INFLOW'
          ? total + inflow.amountMinor
          : total;
      },
      0,
    );

    sharedPaymentExpenseAmountMinor += Math.max(outflowTotal - inflowTotal, 0);
    sharedPaymentCount += 1;
  }

  return {
    budgetBucketId,
    unlinkedExpenseAmountMinor,
    sharedPaymentExpenseAmountMinor,
    totalAmountMinor:
      unlinkedExpenseAmountMinor + sharedPaymentExpenseAmountMinor,
    sharedPaymentCount,
  };
}

export function calculateLivingExpenseSummary(
  transactions: readonly Transaction[],
  settlements: readonly BudgetSettlement[],
  range: TransactionDateRange,
): LivingExpenseSummary {
  const { budgetBucketId: ignoredBudgetBucketId, ...summary } =
    calculateBudgetBucketExpenseSummary(
      transactions,
      settlements,
      range,
      'LIVING',
    );
  void ignoredBudgetBucketId;
  return summary;
}
