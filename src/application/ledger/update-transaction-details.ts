import type { CategoryId } from '../../domain/categories/category';
import type { Transaction } from '../../domain/transactions/transaction';
import { validateTransaction } from '../../domain/transactions/transaction-validation';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';

export type TransactionDetailsRepository = Readonly<{
  getTransactionsByIds: (
    transactionIds: readonly string[],
  ) => Promise<readonly Transaction[]>;
  replaceTransaction: (transaction: Transaction) => Promise<void>;
}>;

export type UpdateTransactionDetailsInput = Readonly<{
  transactionId: string;
  categoryId: CategoryId | undefined;
  memo: string | undefined;
  updatedAt: UtcIsoInstant;
}>;

export type UpdateTransactionDetailsResult =
  | Readonly<{ isUpdated: true; transaction: Transaction }>
  | Readonly<{
      isUpdated: false;
      code: 'transaction_not_found' | 'invalid_transaction' | 'storage_failed';
    }>;

function applyEditableDetails(
  transaction: Transaction,
  input: UpdateTransactionDetailsInput,
): Transaction | undefined {
  const {
    categoryId: ignoredCategoryId,
    memo: ignoredMemo,
    ...transactionWithoutEditableDetails
  } = transaction;
  void ignoredCategoryId;
  void ignoredMemo;

  const validation = validateTransaction({
    ...transactionWithoutEditableDetails,
    ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
    ...(input.memo === undefined ? {} : { memo: input.memo }),
    updatedAt: input.updatedAt,
  });

  return validation.isValid ? validation.value : undefined;
}

export async function updateTransactionDetails(
  input: UpdateTransactionDetailsInput,
  repository: TransactionDetailsRepository,
): Promise<UpdateTransactionDetailsResult> {
  try {
    const existingTransaction = (
      await repository.getTransactionsByIds([input.transactionId])
    )[0];

    if (existingTransaction === undefined) {
      return { isUpdated: false, code: 'transaction_not_found' };
    }

    const nextTransaction = applyEditableDetails(existingTransaction, input);

    if (nextTransaction === undefined) {
      return { isUpdated: false, code: 'invalid_transaction' };
    }

    await repository.replaceTransaction(nextTransaction);
    return { isUpdated: true, transaction: nextTransaction };
  } catch {
    return { isUpdated: false, code: 'storage_failed' };
  }
}
