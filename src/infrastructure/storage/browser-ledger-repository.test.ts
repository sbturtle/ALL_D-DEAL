import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';

import type { ImportBatch } from '../../domain/imports/import-batch';
import type { Transaction } from '../../domain/transactions/transaction';
import { BrowserLedgerRepository } from './browser-ledger-repository';

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

    await repository.commitImport(batch, [earlier, later]);

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
  });

  it('aborts the entire import when one duplicate transaction key fails', async () => {
    const repository = createRepository();
    const duplicate = transaction(
      '550e8400-e29b-41d4-a716-446655440010',
      '2026-08-05',
    );

    await expect(repository.commitImport(batch, [duplicate, duplicate])).rejects.toThrow();

    await expect(repository.listImportBatches()).resolves.toEqual([]);
    await expect(repository.listAllTransactions()).resolves.toEqual([]);
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
});
