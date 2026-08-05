import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it, vi } from 'vitest';

import type { ImportBatch } from '../../domain/imports/import-batch';
import type { CategoryRule } from '../../domain/categories/category-rule';
import type { Transaction } from '../../domain/transactions/transaction';
import {
  BrowserLedgerRepository,
  INDEXED_DB_OPEN_TIMEOUT_MS,
} from './browser-ledger-repository';

const batch: ImportBatch = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  importerId: 'LEGACY_XLS',
  importerVersion: 1,
  sourceType: 'ACCOUNT_LEDGER_XLS',
  committedAt: '2026-08-05T00:00:00.000Z',
  newCount: 2,
  skippedCount: 0,
  reviewedCount: 2,
};

const categoryRule: CategoryRule = {
  matchDescriptionNormalized: 'fabricated cafe',
  categoryId: 'FOOD_DINING',
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
};

function transaction(id: string, occurredOn: string): Transaction {
  return {
    id,
    occurredOn: occurredOn as Transaction['occurredOn'],
    amountMinor: 10_000,
    currency: 'KRW',
    direction: 'OUTFLOW',
    type: 'EXPENSE',
    descriptionOriginal: `Fabricated ${id}`,
    importBatchId: batch.id,
    importerId: 'LEGACY_XLS',
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

function createRepository() {
  return new BrowserLedgerRepository(
    `test-ledger-${crypto.randomUUID()}`,
    new IDBFactory(),
    IDBKeyRange,
  );
}

describe('BrowserLedgerRepository', () => {
  it('persists an import batch and queryable transactions locally', async () => {
    const repository = createRepository();
    const earlier = transaction(
      '550e8400-e29b-41d4-a716-446655440001',
      '2026-08-01',
    );
    const later = transaction(
      '550e8400-e29b-41d4-a716-446655440002',
      '2026-08-05',
    );

    await repository.commitImport(batch, [earlier, later], [categoryRule]);

    await expect(repository.listImportBatches()).resolves.toEqual([batch]);
    await expect(
      repository.listTransactionsInRange({
        startOn: '2026-08-05',
        endOn: '2026-08-05',
      }),
    ).resolves.toEqual([later]);
    await expect(
      repository.listTransactionsInRange({
        startOn: '2026-08-01',
        endOn: '2026-08-05',
      }),
    ).resolves.toEqual([later, earlier]);
    await expect(repository.listCategoryRules()).resolves.toEqual([categoryRule]);
  });

  it('aborts the entire import when one duplicate transaction key fails', async () => {
    const repository = createRepository();
    const duplicate = transaction(
      '550e8400-e29b-41d4-a716-446655440010',
      '2026-08-05',
    );

    await expect(
      repository.commitImport(batch, [duplicate, duplicate], [categoryRule]),
    ).rejects.toThrow();

    await expect(repository.listImportBatches()).resolves.toEqual([]);
    await expect(repository.listAllTransactions()).resolves.toEqual([]);
    await expect(repository.listCategoryRules()).resolves.toEqual([]);
  });

  it('replaces a confirmed rule without rewriting previously stored transactions', async () => {
    const repository = createRepository();
    const firstTransaction = transaction(
      '550e8400-e29b-41d4-a716-446655440031',
      '2026-08-05',
    );
    const nextBatch: ImportBatch = {
      ...batch,
      id: '550e8400-e29b-41d4-a716-446655440030',
      committedAt: '2026-08-06T00:00:00.000Z',
    };
    const replacementRule: CategoryRule = {
      ...categoryRule,
      categoryId: 'LEISURE',
      updatedAt: '2026-08-06T00:00:00.000Z',
    };
    const nextTransaction: Transaction = {
      ...transaction('550e8400-e29b-41d4-a716-446655440032', '2026-08-06'),
      importBatchId: nextBatch.id,
      createdAt: nextBatch.committedAt,
      updatedAt: nextBatch.committedAt,
    };

    await repository.commitImport(batch, [firstTransaction], [categoryRule]);
    await repository.commitImport(nextBatch, [nextTransaction], [replacementRule]);

    await expect(repository.listCategoryRules()).resolves.toEqual([replacementRule]);
    await expect(repository.listAllTransactions()).resolves.toEqual([
      nextTransaction,
      firstTransaction,
    ]);
  });

  it('stores and removes an independent budget settlement', async () => {
    const repository = createRepository();
    const settlement = {
      id: '550e8400-e29b-41d4-a716-446655440020',
      payerOutflowTransactionId: '550e8400-e29b-41d4-a716-446655440021',
      reimbursementInflowTransactionIds: [
        '550e8400-e29b-41d4-a716-446655440022',
      ],
      createdAt: '2026-08-05T00:00:00.000Z',
      updatedAt: '2026-08-05T00:00:00.000Z',
    } as const;

    await repository.saveBudgetSettlement(settlement);
    await expect(repository.listBudgetSettlements()).resolves.toEqual([settlement]);

    await repository.removeBudgetSettlement(settlement.id);
    await expect(repository.listBudgetSettlements()).resolves.toEqual([]);
  });

  it('upgrades a v1 local database by adding empty category-rule storage', async () => {
    const databaseName = `v1-ledger-${crypto.randomUUID()}`;
    const databaseFactory = new IDBFactory();
    const request = databaseFactory.open(databaseName, 1);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.addEventListener(
        'upgradeneeded',
        () => {
          const v1Database = request.result;
          v1Database.createObjectStore('transactions', { keyPath: 'id' });
          v1Database.createObjectStore('importBatches', { keyPath: 'id' });
          v1Database.createObjectStore('budgetSettlements', { keyPath: 'id' });
        },
        { once: true },
      );
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    database.close();

    const repository = new BrowserLedgerRepository(
      databaseName,
      databaseFactory,
      IDBKeyRange,
    );

    await expect(repository.listCategoryRules()).resolves.toEqual([]);
    await expect(repository.listAllTransactions()).resolves.toEqual([]);
  });

  it('fails safely instead of waiting forever when another tab blocks a v1 upgrade', async () => {
    const databaseName = `blocked-v1-ledger-${crypto.randomUUID()}`;
    const databaseFactory = new IDBFactory();
    const request = databaseFactory.open(databaseName, 1);
    const v1Database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.addEventListener(
        'upgradeneeded',
        () => {
          const database = request.result;
          database.createObjectStore('transactions', { keyPath: 'id' });
          database.createObjectStore('importBatches', { keyPath: 'id' });
          database.createObjectStore('budgetSettlements', { keyPath: 'id' });
        },
        { once: true },
      );
      request.addEventListener('success', () => resolve(request.result), { once: true });
      request.addEventListener('error', () => reject(request.error), { once: true });
    });
    const repository = new BrowserLedgerRepository(
      databaseName,
      databaseFactory,
      IDBKeyRange,
    );

    await expect(repository.listAllTransactions()).rejects.toThrow(
      'IndexedDB upgrade is blocked',
    );
    v1Database.close();
  });

  it('fails safely when a database open never emits a terminal event', async () => {
    vi.useFakeTimers();
    const stalledRequest = new EventTarget() as IDBOpenDBRequest;
    const repository = new BrowserLedgerRepository(
      'stalled-ledger',
      {
        open: () => stalledRequest,
      } as unknown as IDBFactory,
      IDBKeyRange,
    );

    const pendingRead = repository.listAllTransactions();
    const rejection = expect(pendingRead).rejects.toThrow(
      'IndexedDB open timed out',
    );
    await vi.advanceTimersByTimeAsync(INDEXED_DB_OPEN_TIMEOUT_MS);

    await rejection;
    vi.useRealTimers();
  });
});
