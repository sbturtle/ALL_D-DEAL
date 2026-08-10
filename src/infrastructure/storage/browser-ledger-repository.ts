import type { ImportBatch } from '../../domain/imports/import-batch';
import type { CategoryRule } from '../../domain/categories/category-rule';
import { validateCategoryRule } from '../../domain/categories/category-rule';
import type { KeywordCategoryRule } from '../../domain/categories/keyword-category-rule';
import { validateKeywordCategoryRule } from '../../domain/categories/keyword-category-rule';
import {
  LOCAL_USER_SETTINGS_ID,
  validateLocalUserSettings,
  type LocalUserSettings,
} from '../../domain/settings/local-user-settings';
import type { BudgetSettlement } from '../../domain/transactions/budget-settlement';
import { validateBudgetSettlement } from '../../domain/transactions/budget-settlement';
import type { TransactionDateRange } from '../../domain/transactions/transaction-period';
import type { Transaction } from '../../domain/transactions/transaction';
import { validateTransaction } from '../../domain/transactions/transaction-validation';

export const LOCAL_LEDGER_DATABASE_NAME = 'household-ledger';
const LOCAL_LEDGER_DATABASE_VERSION = 5;
export const INDEXED_DB_OPEN_TIMEOUT_MS = 5_000;
const TRANSACTIONS_STORE = 'transactions';
const IMPORT_BATCHES_STORE = 'importBatches';
const BUDGET_SETTLEMENTS_STORE = 'budgetSettlements';
const CATEGORY_RULES_STORE = 'categoryRules';
const KEYWORD_CATEGORY_RULES_STORE = 'keywordCategoryRules';
const USER_SETTINGS_STORE = 'userSettings';

type KeyRangeFactory = Readonly<{
  bound: (lower: string, upper: string) => IDBKeyRange;
}>;

function getDefaultDatabaseFactory(): IDBFactory | undefined {
  return typeof indexedDB === 'undefined' ? undefined : indexedDB;
}

function getDefaultKeyRangeFactory(): KeyRangeFactory | undefined {
  return typeof IDBKeyRange === 'undefined' ? undefined : IDBKeyRange;
}

function requestAsPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB request failed.')), {
      once: true,
    });
  });
}

function transactionAsPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.')), {
      once: true,
    });
    transaction.addEventListener('error', () => reject(transaction.error ?? new Error('IndexedDB transaction failed.')), {
      once: true,
    });
  });
}

function validateStoredTransaction(value: unknown): Transaction {
  const validation = validateTransaction(value);
  if (!validation.isValid) {
    throw new Error('Stored transaction is invalid.');
  }

  return validation.value;
}

function validateStoredSettlement(value: unknown): BudgetSettlement {
  const validation = validateBudgetSettlement(value);
  if (!validation.isValid) {
    throw new Error('Stored settlement is invalid.');
  }

  return validation.value;
}

function validateStoredCategoryRule(value: unknown): CategoryRule {
  const validation = validateCategoryRule(value);
  if (!validation.isValid) {
    throw new Error('Stored category rule is invalid.');
  }

  return validation.value;
}

function validateStoredKeywordCategoryRule(value: unknown): KeywordCategoryRule {
  const validation = validateKeywordCategoryRule(value);
  if (!validation.isValid) {
    throw new Error('Stored keyword category rule is invalid.');
  }

  return validation.value;
}

function validateStoredLocalUserSettings(value: unknown): LocalUserSettings {
  const validation = validateLocalUserSettings(value);
  if (!validation.isValid) {
    throw new Error('Stored local user settings are invalid.');
  }

  return validation.value;
}

function sortTransactionsNewestFirst(
  transactions: readonly Transaction[],
): readonly Transaction[] {
  return [...transactions].sort(
    (left, right) =>
      right.occurredOn.localeCompare(left.occurredOn) ||
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.id.localeCompare(left.id),
  );
}

export class BrowserLedgerRepository {
  private databasePromise: Promise<IDBDatabase> | undefined;

  constructor(
    private readonly databaseName = LOCAL_LEDGER_DATABASE_NAME,
    private readonly databaseFactory: IDBFactory | undefined = getDefaultDatabaseFactory(),
    private readonly keyRangeFactory: KeyRangeFactory | undefined = getDefaultKeyRangeFactory(),
  ) {}

  async commitImport(
    batch: ImportBatch,
    transactions: readonly Transaction[],
    categoryRules: readonly CategoryRule[] = [],
  ): Promise<void> {
    for (const categoryRule of categoryRules) {
      validateStoredCategoryRule(categoryRule);
    }

    const database = await this.getDatabase();
    const transaction = database.transaction(
      [IMPORT_BATCHES_STORE, TRANSACTIONS_STORE, CATEGORY_RULES_STORE],
      'readwrite',
    );
    const importBatches = transaction.objectStore(IMPORT_BATCHES_STORE);
    const transactionStore = transaction.objectStore(TRANSACTIONS_STORE);
    const categoryRuleStore = transaction.objectStore(CATEGORY_RULES_STORE);

    importBatches.add(batch);
    for (const item of transactions) {
      transactionStore.add(item);
    }
    for (const categoryRule of categoryRules) {
      categoryRuleStore.put(categoryRule);
    }

    await transactionAsPromise(transaction);
  }

  async listTransactionsInRange(
    range: TransactionDateRange,
  ): Promise<readonly Transaction[]> {
    const database = await this.getDatabase();
    const transaction = database.transaction(TRANSACTIONS_STORE, 'readonly');
    const store = transaction.objectStore(TRANSACTIONS_STORE);
    const index = store.index('occurredOn');
    const rangeFactory = this.keyRangeFactory;

    if (rangeFactory === undefined) {
      throw new Error('IndexedDB key range is unavailable.');
    }

    const values = await requestAsPromise(
      index.getAll(rangeFactory.bound(range.startOn, range.endOn)),
    );
    await transactionAsPromise(transaction);

    return sortTransactionsNewestFirst(values.map(validateStoredTransaction));
  }

  async listAllTransactions(): Promise<readonly Transaction[]> {
    const database = await this.getDatabase();
    const transaction = database.transaction(TRANSACTIONS_STORE, 'readonly');
    const values = await requestAsPromise(
      transaction.objectStore(TRANSACTIONS_STORE).getAll(),
    );
    await transactionAsPromise(transaction);

    return sortTransactionsNewestFirst(values.map(validateStoredTransaction));
  }

  async getTransactionsByIds(
    transactionIds: readonly string[],
  ): Promise<readonly Transaction[]> {
    const database = await this.getDatabase();
    const transaction = database.transaction(TRANSACTIONS_STORE, 'readonly');
    const store = transaction.objectStore(TRANSACTIONS_STORE);
    const values = await Promise.all(
      transactionIds.map((transactionId) =>
        requestAsPromise(store.get(transactionId)),
      ),
    );
    await transactionAsPromise(transaction);

    return values
      .filter((value): value is Transaction => value !== undefined)
      .map(validateStoredTransaction);
  }

  async replaceTransaction(transactionValue: Transaction): Promise<void> {
    const transactionToStore = validateStoredTransaction(transactionValue);
    const database = await this.getDatabase();
    const transaction = database.transaction(TRANSACTIONS_STORE, 'readwrite');
    transaction.objectStore(TRANSACTIONS_STORE).put(transactionToStore);
    await transactionAsPromise(transaction);
  }

  async listImportBatches(): Promise<readonly ImportBatch[]> {
    const database = await this.getDatabase();
    const transaction = database.transaction(IMPORT_BATCHES_STORE, 'readonly');
    const values = await requestAsPromise(
      transaction.objectStore(IMPORT_BATCHES_STORE).getAll(),
    );
    await transactionAsPromise(transaction);

    return values as ImportBatch[];
  }

  async listCategoryRules(): Promise<readonly CategoryRule[]> {
    const database = await this.getDatabase();
    const transaction = database.transaction(CATEGORY_RULES_STORE, 'readonly');
    const values = await requestAsPromise(
      transaction.objectStore(CATEGORY_RULES_STORE).getAll(),
    );
    await transactionAsPromise(transaction);

    return values
      .map(validateStoredCategoryRule)
      .sort((left, right) =>
        left.matchDescriptionNormalized.localeCompare(right.matchDescriptionNormalized),
      );
  }

  async listKeywordCategoryRules(): Promise<readonly KeywordCategoryRule[]> {
    const database = await this.getDatabase();
    const transaction = database.transaction(KEYWORD_CATEGORY_RULES_STORE, 'readonly');
    const values = await requestAsPromise(
      transaction.objectStore(KEYWORD_CATEGORY_RULES_STORE).getAll(),
    );
    await transactionAsPromise(transaction);

    return values
      .map(validateStoredKeywordCategoryRule)
      .sort((left, right) =>
        left.keywordNormalized.localeCompare(right.keywordNormalized),
      );
  }

  async saveKeywordCategoryRuleAndReplaceTransactions(
    keywordCategoryRule: KeywordCategoryRule,
    transactions: readonly Transaction[],
  ): Promise<void> {
    const ruleToStore = validateStoredKeywordCategoryRule(keywordCategoryRule);
    const transactionsToStore = transactions.map(validateStoredTransaction);
    const database = await this.getDatabase();
    const transaction = database.transaction(
      [KEYWORD_CATEGORY_RULES_STORE, TRANSACTIONS_STORE],
      'readwrite',
    );

    transaction
      .objectStore(KEYWORD_CATEGORY_RULES_STORE)
      .put(ruleToStore);
    const transactionStore = transaction.objectStore(TRANSACTIONS_STORE);
    for (const transactionValue of transactionsToStore) {
      transactionStore.put(transactionValue);
    }

    await transactionAsPromise(transaction);
  }

  async listBudgetSettlements(): Promise<readonly BudgetSettlement[]> {
    const database = await this.getDatabase();
    const transaction = database.transaction(BUDGET_SETTLEMENTS_STORE, 'readonly');
    const values = await requestAsPromise(
      transaction.objectStore(BUDGET_SETTLEMENTS_STORE).getAll(),
    );
    await transactionAsPromise(transaction);

    return values.map(validateStoredSettlement);
  }

  async saveBudgetSettlement(settlement: BudgetSettlement): Promise<void> {
    const validation = validateBudgetSettlement(settlement);
    if (!validation.isValid) {
      throw new Error('Invalid budget settlement.');
    }

    const database = await this.getDatabase();
    const transaction = database.transaction(BUDGET_SETTLEMENTS_STORE, 'readwrite');
    transaction.objectStore(BUDGET_SETTLEMENTS_STORE).add(validation.value);
    await transactionAsPromise(transaction);
  }

  async removeBudgetSettlement(settlementId: string): Promise<void> {
    const database = await this.getDatabase();
    const transaction = database.transaction(BUDGET_SETTLEMENTS_STORE, 'readwrite');
    transaction.objectStore(BUDGET_SETTLEMENTS_STORE).delete(settlementId);
    await transactionAsPromise(transaction);
  }

  async getLocalUserSettings(): Promise<LocalUserSettings | undefined> {
    const database = await this.getDatabase();
    const transaction = database.transaction(USER_SETTINGS_STORE, 'readonly');
    const value = await requestAsPromise(
      transaction.objectStore(USER_SETTINGS_STORE).get(LOCAL_USER_SETTINGS_ID),
    );
    await transactionAsPromise(transaction);

    return value === undefined ? undefined : validateStoredLocalUserSettings(value);
  }

  async saveLocalUserSettings(settings: LocalUserSettings): Promise<void> {
    const settingsToStore = validateStoredLocalUserSettings(settings);
    const database = await this.getDatabase();
    const transaction = database.transaction(USER_SETTINGS_STORE, 'readwrite');
    transaction.objectStore(USER_SETTINGS_STORE).put(settingsToStore);
    await transactionAsPromise(transaction);
  }

  async removeLocalUserSettings(): Promise<void> {
    const database = await this.getDatabase();
    const transaction = database.transaction(USER_SETTINGS_STORE, 'readwrite');
    transaction.objectStore(USER_SETTINGS_STORE).delete(LOCAL_USER_SETTINGS_ID);
    await transactionAsPromise(transaction);
  }

  async resetLocalLedger(): Promise<void> {
    const database = await this.getDatabase();
    const transaction = database.transaction(
      [
        TRANSACTIONS_STORE,
        IMPORT_BATCHES_STORE,
        BUDGET_SETTLEMENTS_STORE,
        CATEGORY_RULES_STORE,
        KEYWORD_CATEGORY_RULES_STORE,
        USER_SETTINGS_STORE,
      ],
      'readwrite',
    );

    transaction.objectStore(TRANSACTIONS_STORE).clear();
    transaction.objectStore(IMPORT_BATCHES_STORE).clear();
    transaction.objectStore(BUDGET_SETTLEMENTS_STORE).clear();
    transaction.objectStore(CATEGORY_RULES_STORE).clear();
    transaction.objectStore(KEYWORD_CATEGORY_RULES_STORE).clear();
    transaction.objectStore(USER_SETTINGS_STORE).clear();
    await transactionAsPromise(transaction);
  }

  private getDatabase(): Promise<IDBDatabase> {
    if (this.databasePromise === undefined) {
      this.databasePromise = this.openDatabase();
    }

    return this.databasePromise;
  }

  private openDatabase(): Promise<IDBDatabase> {
    const databaseFactory = this.databaseFactory;
    if (databaseFactory === undefined) {
      return Promise.reject(new Error('IndexedDB is unavailable.'));
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const settle = (callback: () => void): boolean => {
        if (isSettled) {
          return false;
        }

        isSettled = true;
        clearTimeout(timeoutId);
        callback();
        return true;
      };
      const request = databaseFactory.open(
        this.databaseName,
        LOCAL_LEDGER_DATABASE_VERSION,
      );

      request.addEventListener(
        'upgradeneeded',
        (event) => {
          const database = request.result;
          if (!database.objectStoreNames.contains(TRANSACTIONS_STORE)) {
            const transactions = database.createObjectStore(TRANSACTIONS_STORE, {
              keyPath: 'id',
            });
            transactions.createIndex('occurredOn', 'occurredOn', { unique: false });
            transactions.createIndex('importBatchId', 'importBatchId', {
              unique: false,
            });
          }
          if (!database.objectStoreNames.contains(IMPORT_BATCHES_STORE)) {
            const importBatches = database.createObjectStore(IMPORT_BATCHES_STORE, {
              keyPath: 'id',
            });
            importBatches.createIndex('committedAt', 'committedAt', {
              unique: false,
            });
          }
          if (!database.objectStoreNames.contains(BUDGET_SETTLEMENTS_STORE)) {
            const settlements = database.createObjectStore(BUDGET_SETTLEMENTS_STORE, {
              keyPath: 'id',
            });
            settlements.createIndex(
              'outflowTransactionIds',
              'outflowTransactionIds',
              { unique: false, multiEntry: true },
            );
          }
          if (!database.objectStoreNames.contains(CATEGORY_RULES_STORE)) {
            database.createObjectStore(CATEGORY_RULES_STORE, {
              keyPath: 'matchDescriptionNormalized',
            });
          }
          if (!database.objectStoreNames.contains(KEYWORD_CATEGORY_RULES_STORE)) {
            database.createObjectStore(KEYWORD_CATEGORY_RULES_STORE, {
              keyPath: 'keywordNormalized',
            });
          }
          if (!database.objectStoreNames.contains(USER_SETTINGS_STORE)) {
            database.createObjectStore(USER_SETTINGS_STORE, {
              keyPath: 'id',
            });
          }

          if (
            (event as IDBVersionChangeEvent).oldVersion < 5 &&
            request.transaction !== null
          ) {
            const settlements = request.transaction.objectStore(
              BUDGET_SETTLEMENTS_STORE,
            );
            if (!settlements.indexNames.contains('outflowTransactionIds')) {
              settlements.createIndex(
                'outflowTransactionIds',
                'outflowTransactionIds',
                { unique: false, multiEntry: true },
              );
            }

            const cursorRequest = settlements.openCursor();
            cursorRequest.addEventListener('success', () => {
              const cursor = cursorRequest.result;
              if (cursor === null) {
                return;
              }

              const value = cursor.value as Record<string, unknown>;
              if (
                value.outflowTransactionIds === undefined &&
                typeof value.payerOutflowTransactionId === 'string' &&
                Array.isArray(value.reimbursementInflowTransactionIds)
              ) {
                const {
                  payerOutflowTransactionId,
                  reimbursementInflowTransactionIds,
                  ...rest
                } = value;
                cursor.update({
                  ...rest,
                  outflowTransactionIds: [payerOutflowTransactionId],
                  inflowTransactionIds: reimbursementInflowTransactionIds,
                });
              }
              cursor.continue();
            });
          }
        },
        { once: true },
      );
      request.addEventListener(
        'success',
        () => {
          if (!settle(() => resolve(request.result))) {
            request.result.close();
          }
        },
        { once: true },
      );
      request.addEventListener(
        'error',
        () =>
          settle(() =>
            reject(request.error ?? new Error('IndexedDB open failed.')),
          ),
        { once: true },
      );
      request.addEventListener(
        'blocked',
        () =>
          settle(() =>
            reject(new Error('IndexedDB upgrade is blocked by another open tab.')),
          ),
        { once: true },
      );
      const timeoutId = setTimeout(
        () => settle(() => reject(new Error('IndexedDB open timed out.'))),
        INDEXED_DB_OPEN_TIMEOUT_MS,
      );
    });
  }
}
