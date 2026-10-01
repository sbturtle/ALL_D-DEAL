import type { ImportBatch } from '../../domain/imports/import-batch';
import {
  DEFAULT_BUDGET_BUCKETS,
  getDefaultBudgetBucket,
  validateBudgetBucket,
  type BudgetBucket,
} from '../../domain/budget-buckets/budget-bucket';
import type { CategoryRule } from '../../domain/categories/category-rule';
import { validateCategoryRule } from '../../domain/categories/category-rule';
import type { KeywordCategoryRule } from '../../domain/categories/keyword-category-rule';
import { validateKeywordCategoryRule } from '../../domain/categories/keyword-category-rule';
import {
  validateCustomCategory,
  type CustomCategory,
} from '../../domain/categories/custom-category';
import {
  LOCAL_USER_SETTINGS_ID,
  validateLocalUserSettings,
  type LocalUserSettings,
} from '../../domain/settings/local-user-settings';
import type { BudgetSettlement } from '../../domain/transactions/budget-settlement';
import { validateBudgetSettlement } from '../../domain/transactions/budget-settlement';
import {
  validateTransactionAttachment,
  type TransactionAttachment,
} from '../../domain/transactions/transaction-attachment';
import type { TransactionDateRange } from '../../domain/transactions/transaction-period';
import type { Transaction } from '../../domain/transactions/transaction';
import { validateTransaction } from '../../domain/transactions/transaction-validation';
import {
  validateLocalLedgerSnapshot,
  type LocalLedgerSnapshot,
} from '../../domain/ledger-backup/local-ledger-backup';

export const LOCAL_LEDGER_DATABASE_NAME = 'household-ledger';
const LOCAL_LEDGER_DATABASE_VERSION = 7;
export const INDEXED_DB_OPEN_TIMEOUT_MS = 5_000;
const TRANSACTIONS_STORE = 'transactions';
const IMPORT_BATCHES_STORE = 'importBatches';
const BUDGET_SETTLEMENTS_STORE = 'budgetSettlements';
const CATEGORY_RULES_STORE = 'categoryRules';
const KEYWORD_CATEGORY_RULES_STORE = 'keywordCategoryRules';
const USER_SETTINGS_STORE = 'userSettings';
const BUDGET_BUCKETS_STORE = 'budgetBuckets';
const CUSTOM_CATEGORIES_STORE = 'customCategories';
const TRANSACTION_ATTACHMENTS_STORE = 'transactionAttachments';
const LOCAL_LEDGER_STORE_NAMES = [
  TRANSACTIONS_STORE,
  IMPORT_BATCHES_STORE,
  BUDGET_SETTLEMENTS_STORE,
  CATEGORY_RULES_STORE,
  KEYWORD_CATEGORY_RULES_STORE,
  USER_SETTINGS_STORE,
  BUDGET_BUCKETS_STORE,
  CUSTOM_CATEGORIES_STORE,
  TRANSACTION_ATTACHMENTS_STORE,
] as const;

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

function getAllValues(store: IDBObjectStore): Promise<readonly unknown[]> {
  return requestAsPromise(store.getAll() as IDBRequest<unknown[]>);
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

function validateStoredBudgetBucket(value: unknown): BudgetBucket {
  const validation = validateBudgetBucket(value);
  if (!validation.isValid) {
    throw new Error('Stored budget bucket is invalid.');
  }

  return validation.value;
}

function validateStoredCustomCategory(value: unknown): CustomCategory {
  const validation = validateCustomCategory(value);
  if (!validation.isValid) {
    throw new Error('Stored custom category is invalid.');
  }

  return validation.value;
}

function validateStoredTransactionAttachment(
  value: unknown,
): TransactionAttachment {
  const validation = validateTransactionAttachment(value);
  if (!validation.isValid) {
    throw new Error('Stored transaction attachment is invalid.');
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

  async listCustomCategories(): Promise<readonly CustomCategory[]> {
    const database = await this.getDatabase();
    const transaction = database.transaction(CUSTOM_CATEGORIES_STORE, 'readonly');
    const values = await requestAsPromise(
      transaction.objectStore(CUSTOM_CATEGORIES_STORE).getAll(),
    );
    await transactionAsPromise(transaction);

    return values
      .map(validateStoredCustomCategory)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async saveCustomCategory(category: CustomCategory): Promise<void> {
    const categoryToStore = validateStoredCustomCategory(category);
    const database = await this.getDatabase();
    const transaction = database.transaction(
      CUSTOM_CATEGORIES_STORE,
      'readwrite',
    );
    transaction.objectStore(CUSTOM_CATEGORIES_STORE).put(categoryToStore);
    await transactionAsPromise(transaction);
  }

  async getTransactionAttachment(
    transactionId: string,
  ): Promise<TransactionAttachment | undefined> {
    const database = await this.getDatabase();
    const transaction = database.transaction(
      TRANSACTION_ATTACHMENTS_STORE,
      'readonly',
    );
    const value = await requestAsPromise(
      transaction.objectStore(TRANSACTION_ATTACHMENTS_STORE).get(transactionId),
    );
    await transactionAsPromise(transaction);

    return value === undefined
      ? undefined
      : validateStoredTransactionAttachment(value);
  }

  async saveTransactionAttachment(
    attachment: TransactionAttachment,
  ): Promise<void> {
    const attachmentToStore = validateStoredTransactionAttachment(attachment);
    const database = await this.getDatabase();
    const transaction = database.transaction(
      TRANSACTION_ATTACHMENTS_STORE,
      'readwrite',
    );
    transaction
      .objectStore(TRANSACTION_ATTACHMENTS_STORE)
      .put(attachmentToStore);
    await transactionAsPromise(transaction);
  }

  async removeTransactionAttachment(transactionId: string): Promise<void> {
    const database = await this.getDatabase();
    const transaction = database.transaction(
      TRANSACTION_ATTACHMENTS_STORE,
      'readwrite',
    );
    transaction.objectStore(TRANSACTION_ATTACHMENTS_STORE).delete(transactionId);
    await transactionAsPromise(transaction);
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

  async getLocalLedgerSnapshot(): Promise<LocalLedgerSnapshot> {
    const database = await this.getDatabase();
    const transaction = database.transaction(
      [...LOCAL_LEDGER_STORE_NAMES],
      'readonly',
    );
    const requests = LOCAL_LEDGER_STORE_NAMES.map((storeName) =>
      getAllValues(transaction.objectStore(storeName)),
    );

    const valuesPromise = Promise.all(requests);
    const transactionPromise = transactionAsPromise(transaction);
    const [values] = await Promise.all([valuesPromise, transactionPromise]);
    const [
      transactions,
      importBatches,
      budgetSettlements,
      categoryRules,
      keywordCategoryRules,
      userSettings,
      budgetBuckets,
      customCategories,
      transactionAttachments,
    ] = values;

    const userSettingsCandidate =
      userSettings.length === 0
        ? null
        : userSettings.length === 1
          ? userSettings[0]
          : userSettings;
    const validation = validateLocalLedgerSnapshot({
      transactions,
      importBatches,
      budgetSettlements,
      categoryRules,
      keywordCategoryRules,
      userSettings: userSettingsCandidate,
      budgetBuckets,
      customCategories,
      transactionAttachments,
    });
    if (!validation.isValid) {
      throw new Error('Stored local ledger snapshot is invalid.');
    }

    return {
      ...validation.value,
      budgetBuckets: [...validation.value.budgetBuckets].sort(
        (left, right) =>
          left.order - right.order || left.name.localeCompare(right.name),
      ),
    };
  }

  async replaceLocalLedger(snapshot: unknown): Promise<void> {
    const validation = validateLocalLedgerSnapshot(snapshot);
    if (!validation.isValid) {
      throw new Error('Local ledger snapshot is invalid.');
    }

    const database = await this.getDatabase();
    const transaction = database.transaction(
      [...LOCAL_LEDGER_STORE_NAMES],
      'readwrite',
    );
    const transactions = transaction.objectStore(TRANSACTIONS_STORE);
    const importBatches = transaction.objectStore(IMPORT_BATCHES_STORE);
    const budgetSettlements = transaction.objectStore(BUDGET_SETTLEMENTS_STORE);
    const categoryRules = transaction.objectStore(CATEGORY_RULES_STORE);
    const keywordCategoryRules = transaction.objectStore(
      KEYWORD_CATEGORY_RULES_STORE,
    );
    const userSettings = transaction.objectStore(USER_SETTINGS_STORE);
    const budgetBuckets = transaction.objectStore(BUDGET_BUCKETS_STORE);
    const customCategories = transaction.objectStore(CUSTOM_CATEGORIES_STORE);
    const transactionAttachments = transaction.objectStore(
      TRANSACTION_ATTACHMENTS_STORE,
    );
    for (const store of [
      transactions,
      importBatches,
      budgetSettlements,
      categoryRules,
      keywordCategoryRules,
      userSettings,
      budgetBuckets,
      customCategories,
      transactionAttachments,
    ]) {
      store.clear();
    }

    const value = validation.value;
    for (const item of value.transactions) {
      transactions.put(item);
    }
    for (const item of value.importBatches) {
      importBatches.put(item);
    }
    for (const item of value.budgetSettlements) {
      budgetSettlements.put(item);
    }
    for (const item of value.categoryRules) {
      categoryRules.put(item);
    }
    for (const item of value.keywordCategoryRules) {
      keywordCategoryRules.put(item);
    }
    if (value.userSettings !== null) {
      userSettings.put(value.userSettings);
    }
    for (const item of value.budgetBuckets) {
      budgetBuckets.put(item);
    }
    for (const item of value.customCategories) {
      customCategories.put(item);
    }
    for (const item of value.transactionAttachments) {
      transactionAttachments.put(item);
    }

    await transactionAsPromise(transaction);
  }

  async listBudgetBuckets(): Promise<readonly BudgetBucket[]> {
    const database = await this.getDatabase();
    const transaction = database.transaction(BUDGET_BUCKETS_STORE, 'readonly');
    const values = await requestAsPromise(
      transaction.objectStore(BUDGET_BUCKETS_STORE).getAll(),
    );
    await transactionAsPromise(transaction);

    return values
      .map(validateStoredBudgetBucket)
      .sort(
        (left, right) =>
          left.order - right.order || left.name.localeCompare(right.name),
      );
  }

  async saveBudgetBucket(bucket: BudgetBucket): Promise<void> {
    const bucketToStore = validateStoredBudgetBucket(bucket);
    const defaultBucket = getDefaultBudgetBucket(bucketToStore.id);
    if (
      (defaultBucket !== undefined &&
        (!bucketToStore.isDefault || bucketToStore.isArchived)) ||
      (defaultBucket === undefined && bucketToStore.isDefault)
    ) {
      throw new Error('Budget bucket default status is invalid.');
    }

    const database = await this.getDatabase();
    const transaction = database.transaction(BUDGET_BUCKETS_STORE, 'readwrite');
    transaction.objectStore(BUDGET_BUCKETS_STORE).put(bucketToStore);
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
        BUDGET_BUCKETS_STORE,
        CUSTOM_CATEGORIES_STORE,
        TRANSACTION_ATTACHMENTS_STORE,
      ],
      'readwrite',
    );

    transaction.objectStore(TRANSACTIONS_STORE).clear();
    transaction.objectStore(IMPORT_BATCHES_STORE).clear();
    transaction.objectStore(BUDGET_SETTLEMENTS_STORE).clear();
    transaction.objectStore(CATEGORY_RULES_STORE).clear();
    transaction.objectStore(KEYWORD_CATEGORY_RULES_STORE).clear();
    transaction.objectStore(USER_SETTINGS_STORE).clear();
    transaction.objectStore(CUSTOM_CATEGORIES_STORE).clear();
    transaction.objectStore(TRANSACTION_ATTACHMENTS_STORE).clear();
    const budgetBuckets = transaction.objectStore(BUDGET_BUCKETS_STORE);
    budgetBuckets.clear();
    for (const bucket of DEFAULT_BUDGET_BUCKETS) {
      budgetBuckets.put(bucket);
    }
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
          if (!database.objectStoreNames.contains(BUDGET_BUCKETS_STORE)) {
            const budgetBuckets = database.createObjectStore(BUDGET_BUCKETS_STORE, {
              keyPath: 'id',
            });
            budgetBuckets.createIndex('order', 'order', { unique: false });
          }
          if (!database.objectStoreNames.contains(CUSTOM_CATEGORIES_STORE)) {
            database.createObjectStore(CUSTOM_CATEGORIES_STORE, {
              keyPath: 'id',
            });
          }
          if (!database.objectStoreNames.contains(TRANSACTION_ATTACHMENTS_STORE)) {
            database.createObjectStore(TRANSACTION_ATTACHMENTS_STORE, {
              keyPath: 'transactionId',
            });
          }

          if (
            (event as IDBVersionChangeEvent).oldVersion < 6 &&
            request.transaction !== null
          ) {
            const transactions = request.transaction.objectStore(TRANSACTIONS_STORE);
            const transactionCursorRequest = transactions.openCursor();
            transactionCursorRequest.addEventListener('success', () => {
              const cursor = transactionCursorRequest.result;
              if (cursor === null) {
                return;
              }

              const value = cursor.value as Record<string, unknown>;
              if (value.budgetBucketId === undefined) {
                cursor.update({ ...value, budgetBucketId: 'LIVING' });
              }
              cursor.continue();
            });

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
              let nextValue = value;
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
                nextValue = {
                  ...rest,
                  outflowTransactionIds: [payerOutflowTransactionId],
                  inflowTransactionIds: reimbursementInflowTransactionIds,
                };
              }
              if (nextValue.budgetBucketId === undefined) {
                nextValue = { ...nextValue, budgetBucketId: 'LIVING' };
              }
              if (nextValue !== value) {
                cursor.update(nextValue);
              }
              cursor.continue();
            });

            const budgetBuckets = request.transaction.objectStore(
              BUDGET_BUCKETS_STORE,
            );
            for (const bucket of DEFAULT_BUDGET_BUCKETS) {
              budgetBuckets.put(bucket);
            }
          }

          if (
            (event as IDBVersionChangeEvent).oldVersion < 7 &&
            request.transaction !== null
          ) {
            const budgetBuckets = request.transaction.objectStore(
              BUDGET_BUCKETS_STORE,
            );
            const cursorRequest = budgetBuckets.openCursor();
            cursorRequest.addEventListener('success', () => {
              const cursor = cursorRequest.result;
              if (cursor === null) {
                return;
              }

              const value = cursor.value as Record<string, unknown>;
              if (value.isArchived === undefined) {
                cursor.update({ ...value, isArchived: false });
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
