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
  const payerIds = new Set(
    settlements.map((settlement) => settlement.payerOutflowTransactionId),
  );
  let unlinkedExpenseAmountMinor = 0;
  let sharedPaymentExpenseAmountMinor = 0;
  let sharedPaymentCount = 0;

  for (const transaction of transactions) {
    if (
      isDateInTransactionRange(transaction.occurredOn, range) &&
      isLivingExpense(transaction) &&
      !payerIds.has(transaction.id)
    ) {
      unlinkedExpenseAmountMinor += transaction.amountMinor;
    }
  }

  for (const settlement of settlements) {
    const payer = transactionById.get(settlement.payerOutflowTransactionId);
    if (
      payer === undefined ||
      payer.direction !== 'OUTFLOW' ||
      !isDateInTransactionRange(payer.occurredOn, range)
    ) {
      continue;
    }

    const reimbursementTotal = settlement.reimbursementInflowTransactionIds.reduce(
      (total, transactionId) => {
        const reimbursement = transactionById.get(transactionId);
        return reimbursement?.direction === 'INFLOW'
          ? total + reimbursement.amountMinor
          : total;
      },
      0,
    );

    sharedPaymentExpenseAmountMinor += Math.max(
      payer.amountMinor - reimbursementTotal,
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
