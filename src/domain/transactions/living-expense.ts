import type { Transaction } from './transaction';

type LivingExpenseCandidate = Pick<Transaction, 'direction' | 'type'>;

export function isLivingExpense(
  transaction: LivingExpenseCandidate,
): boolean {
  return transaction.type === 'EXPENSE' && transaction.direction === 'OUTFLOW';
}
