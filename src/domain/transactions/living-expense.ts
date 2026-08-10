import type { BudgetSettlement } from './budget-settlement';
import { isDateInTransactionRange } from './transaction-period';
import type { TransactionDateRange } from './transaction-period';
import type { Transaction } from './transaction';

type LivingExpenseCandidate = Pick<Transaction, 'direction' | 'type'>;

export function isLivingExpense(
  transaction: LivingExpenseCandidate,
): boolean {
  return transaction.type === 'EXPENSE' && transaction.direction === 'OUTFLOW';
}

export type LivingExpenseSummary = Readonly<{
  unlinkedExpenseAmountMinor: number;
  sharedPaymentExpenseAmountMinor: number;
  totalAmountMinor: number;
  sharedPaymentCount: number;
}>;

export function calculateLivingExpenseSummary(
  transactions: readonly Transaction[],
  settlements: readonly BudgetSettlement[],
  range: TransactionDateRange,
): LivingExpenseSummary {
  const transactionById = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  const linkedOutflowIds = new Set(
    settlements.flatMap((settlement) => settlement.outflowTransactionIds),
  );
  let unlinkedExpenseAmountMinor = 0;
  let sharedPaymentExpenseAmountMinor = 0;
  let sharedPaymentCount = 0;

  for (const transaction of transactions) {
    if (
      isDateInTransactionRange(transaction.occurredOn, range) &&
      isLivingExpense(transaction) &&
      !linkedOutflowIds.has(transaction.id)
    ) {
      unlinkedExpenseAmountMinor += transaction.amountMinor;
    }
  }

  for (const settlement of settlements) {
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

    sharedPaymentExpenseAmountMinor += Math.max(
      outflowTotal - inflowTotal,
      0,
    );
    sharedPaymentCount += 1;
  }

  return {
    unlinkedExpenseAmountMinor,
    sharedPaymentExpenseAmountMinor,
    totalAmountMinor:
      unlinkedExpenseAmountMinor + sharedPaymentExpenseAmountMinor,
    sharedPaymentCount,
  };
}
