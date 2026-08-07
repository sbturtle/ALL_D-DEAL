import type { CategoryId } from '../../domain/categories/category';
import {
  createKeywordCategoryRule,
  findKeywordCategoryRule,
  type KeywordCategoryRule,
} from '../../domain/categories/keyword-category-rule';
import type { Transaction } from '../../domain/transactions/transaction';
import { validateTransaction } from '../../domain/transactions/transaction-validation';
import type { UtcIsoInstant } from '../../domain/transactions/utc-iso-instant';

export type KeywordCategoryGroupingRepository = Readonly<{
  listAllTransactions: () => Promise<readonly Transaction[]>;
  saveKeywordCategoryRuleAndReplaceTransactions: (
    keywordCategoryRule: KeywordCategoryRule,
    transactions: readonly Transaction[],
  ) => Promise<void>;
}>;

export type ApplyKeywordCategoryGroupingInput = Readonly<{
  keyword: string;
  categoryId: CategoryId;
  updatedAt: UtcIsoInstant;
}>;

export type ApplyKeywordCategoryGroupingResult =
  | Readonly<{
      isApplied: true;
      keywordCategoryRule: KeywordCategoryRule;
      transactions: readonly Transaction[];
    }>
  | Readonly<{
      isApplied: false;
      code: 'invalid_keyword' | 'no_matching_transactions' | 'invalid_transaction' | 'storage_failed';
    }>;

function applyCategoryToTransaction(
  transaction: Transaction,
  categoryId: CategoryId,
  updatedAt: UtcIsoInstant,
): Transaction | undefined {
  const { categoryId: ignoredCategoryId, ...transactionWithoutCategory } = transaction;
  void ignoredCategoryId;

  const validation = validateTransaction({
    ...transactionWithoutCategory,
    categoryId,
    updatedAt,
  });

  return validation.isValid ? validation.value : undefined;
}

export async function applyKeywordCategoryGrouping(
  input: ApplyKeywordCategoryGroupingInput,
  repository: KeywordCategoryGroupingRepository,
): Promise<ApplyKeywordCategoryGroupingResult> {
  const keywordCategoryRule = createKeywordCategoryRule(
    { keyword: input.keyword, categoryId: input.categoryId },
    input.updatedAt,
  );
  if (keywordCategoryRule === null) {
    return { isApplied: false, code: 'invalid_keyword' };
  }

  try {
    const matchingTransactions = (await repository.listAllTransactions()).filter(
      (transaction) =>
        transaction.type === 'EXPENSE' &&
        transaction.categoryId === undefined &&
        findKeywordCategoryRule(transaction.descriptionOriginal, [
          keywordCategoryRule,
        ]) !== undefined,
    );
    if (matchingTransactions.length === 0) {
      return { isApplied: false, code: 'no_matching_transactions' };
    }

    const updatedTransactions: Transaction[] = [];
    for (const transaction of matchingTransactions) {
      const updatedTransaction = applyCategoryToTransaction(
        transaction,
        input.categoryId,
        input.updatedAt,
      );
      if (updatedTransaction === undefined) {
        return { isApplied: false, code: 'invalid_transaction' };
      }
      updatedTransactions.push(updatedTransaction);
    }

    await repository.saveKeywordCategoryRuleAndReplaceTransactions(
      keywordCategoryRule,
      updatedTransactions,
    );

    return {
      isApplied: true,
      keywordCategoryRule,
      transactions: updatedTransactions,
    };
  } catch {
    return { isApplied: false, code: 'storage_failed' };
  }
}
