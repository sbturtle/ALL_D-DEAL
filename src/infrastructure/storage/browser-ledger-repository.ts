import type { ImportBatch } from '../../domain/imports/import-batch';
import type { CategoryRule } from '../../domain/categories/category-rule';
import { validateCategoryRule } from '../../domain/categories/category-rule';
import type { BudgetSettlement } from '../../domain/transactions/budget-settlement';
import { validateBudgetSettlement } from '../../domain/transactions/budget-settlement';
import type { TransactionDateRange } from '../../domain/transactions/transaction-period';
import type { Transaction } from '../../domain/transactions/transaction';
import { validateTransaction } from '../../domain/transactions/transaction-validation';

export const LOCAL_LEDGER_DATABASE_NAME = 'household-ledger';
const LOCAL_LEDGER_DATABASE_VERSION = 2;
const TRANSACTIONS_STORE = 'transactions';
const IMPORT_BATCHES_STORE = 'importBatches';
const BUDGET_SETTLEMENTS_STORE = 'budgetSettlements';
const CATEGORY_RULES_STORE = 'categoryRules';

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
      const request = databaseFactory.open(
        this.databaseName,
        LOCAL_LEDGER_DATABASE_VERSION,
      );

      request.addEventListener(
        'upgradeneeded',
        () => {
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
              'payerOutflowTransactionId',
              'payerOutflowTransactionId',
              { unique: false },
            );
          }
          if (!database.objectStoreNames.contains(CATEGORY_RULES_STORE)) {
            database.createObjectStore(CATEGORY_RULES_STORE, {
              keyPath: 'matchDescriptionNormalized',
            });
          }
        },
        { once: true },
      );
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error ?? new Error('IndexedDB open failed.')), {
        once: true,
      });
    });
  }
}
