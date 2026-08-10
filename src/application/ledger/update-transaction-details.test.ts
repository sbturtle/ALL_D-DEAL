import { describe, expect, it, vi } from 'vitest';

import type { Transaction } from '../../domain/transactions/transaction';
import { updateTransactionDetails } from './update-transaction-details';

const existingTransaction: Transaction = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  occurredOn: '2026-08-05',
  amountMinor: 12_000,
  currency: 'KRW',
  direction: 'OUTFLOW',
  type: 'EXPENSE',
  categoryId: 'FOOD_DINING',
  budgetBucketId: 'LIVING',
  descriptionOriginal: 'Fabricated local meal',
  memo: 'Fabricated previous note',
  importBatchId: '550e8400-e29b-41d4-a716-446655440000',
  importerId: 'LEGACY_XLS',
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
};

describe('updateTransactionDetails', () => {
  it('replaces only category and memo while preserving transaction trace fields', async () => {
    const replaceTransaction = vi.fn().mockResolvedValue(undefined);
    const result = await updateTransactionDetails(
      {
        transactionId: existingTransaction.id,
        categoryId: 'CAFE',
        budgetBucketId: 'IRREGULAR',
        memo: 'Fabricated updated note',
        updatedAt: '2026-08-05T01:00:00.000Z',
      },
      {
        getTransactionsByIds: async () => [existingTransaction],
        replaceTransaction,
      },
    );

    expect(result).toEqual({
      isUpdated: true,
      transaction: {
        ...existingTransaction,
        categoryId: 'CAFE',
        budgetBucketId: 'IRREGULAR',
        memo: 'Fabricated updated note',
        updatedAt: '2026-08-05T01:00:00.000Z',
      },
    });
    expect(replaceTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        importBatchId: existingTransaction.importBatchId,
        importerId: existingTransaction.importerId,
      }),
    );
  });

  it('allows the category and memo to be cleared without creating a transaction', async () => {
    const replaceTransaction = vi.fn().mockResolvedValue(undefined);
    const result = await updateTransactionDetails(
      {
        transactionId: existingTransaction.id,
        categoryId: undefined,
        budgetBucketId: 'LIVING',
        memo: undefined,
        updatedAt: '2026-08-05T01:00:00.000Z',
      },
      {
        getTransactionsByIds: async () => [existingTransaction],
        replaceTransaction,
      },
    );

    expect(result).toMatchObject({
      isUpdated: true,
      transaction: {
        id: existingTransaction.id,
        updatedAt: '2026-08-05T01:00:00.000Z',
      },
    });
    if (result.isUpdated) {
      expect(result.transaction).not.toHaveProperty('categoryId');
      expect(result.transaction).not.toHaveProperty('memo');
    }
  });

  it('does not write when the transaction is missing', async () => {
    const replaceTransaction = vi.fn();
    await expect(
      updateTransactionDetails(
        {
          transactionId: existingTransaction.id,
          categoryId: 'CAFE',
          budgetBucketId: 'LIVING',
          memo: undefined,
          updatedAt: '2026-08-05T01:00:00.000Z',
        },
        {
          getTransactionsByIds: async () => [],
          replaceTransaction,
        },
      ),
    ).resolves.toEqual({ isUpdated: false, code: 'transaction_not_found' });
    expect(replaceTransaction).not.toHaveBeenCalled();
  });
});
