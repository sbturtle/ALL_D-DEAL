import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Transaction } from '../../domain/transactions/transaction';
import type { KeywordCategoryRule } from '../../domain/categories/keyword-category-rule';
import { ReviewPage, type ReviewLedgerRepository } from './review-page';

const firstExpense: Transaction = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  occurredOn: '2026-07-01',
  amountMinor: 12_000,
  currency: 'KRW',
  direction: 'OUTFLOW',
  type: 'EXPENSE',
  descriptionOriginal: 'Fabricated first uncategorized expense',
  paymentInstrumentLabel: 'Fabricated card',
  importBatchId: '550e8400-e29b-41d4-a716-446655440000',
  importerId: 'LEGACY_XLS',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const secondExpense: Transaction = {
  ...firstExpense,
  id: '550e8400-e29b-41d4-a716-446655440002',
  occurredOn: '2026-07-02',
  descriptionOriginal: 'Fabricated second uncategorized expense',
};

const unknownTransaction: Transaction = {
  ...firstExpense,
  id: '550e8400-e29b-41d4-a716-446655440003',
  type: 'UNKNOWN',
  descriptionOriginal: 'Fabricated unknown transaction',
};

const categorizedExpense: Transaction = {
  ...firstExpense,
  id: '550e8400-e29b-41d4-a716-446655440004',
  categoryId: 'FOOD_DINING',
  descriptionOriginal: 'Fabricated categorized expense',
};

function createRepository(
  initialTransactions: readonly Transaction[],
): ReviewLedgerRepository & {
  replaceTransaction: ReturnType<typeof vi.fn>;
  saveKeywordCategoryRuleAndReplaceTransactions: ReturnType<typeof vi.fn>;
} {
  let storedTransactions = [...initialTransactions];
  const replaceTransaction = vi.fn(async (transaction: Transaction) => {
    storedTransactions = storedTransactions.map((current) =>
      current.id === transaction.id ? transaction : current,
    );
  });
  const saveKeywordCategoryRuleAndReplaceTransactions = vi.fn(
    async (
      _keywordCategoryRule: KeywordCategoryRule,
      replacements: readonly Transaction[],
    ) => {
      const replacementsById = new Map(
        replacements.map((transaction) => [transaction.id, transaction]),
      );
      storedTransactions = storedTransactions.map(
        (transaction) => replacementsById.get(transaction.id) ?? transaction,
      );
    },
  );

  return {
    listAllTransactions: async () => storedTransactions,
    getTransactionsByIds: async (transactionIds) =>
      storedTransactions.filter((transaction) => transactionIds.includes(transaction.id)),
    replaceTransaction,
    saveKeywordCategoryRuleAndReplaceTransactions,
  };
}

describe('ReviewPage', () => {
  it('queues real uncategorized expenses one at a time and advances after saving', async () => {
    const user = userEvent.setup();
    const repository = createRepository([
      categorizedExpense,
      unknownTransaction,
      secondExpense,
      firstExpense,
    ]);

    render(<ReviewPage ledgerRepository={repository} />);

    expect(
      await screen.findByRole('heading', { name: '2건 중 1번째' }),
    ).toBeVisible();
    expect(screen.getByText('2건')).toBeVisible();
    expect(
      screen.getByRole('heading', {
        name: 'Fabricated first uncategorized expense',
      }),
    ).toBeVisible();
    expect(screen.getByText('2026-07-01 · 지출 · Fabricated card')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '카페' }));

    await waitFor(() => {
      expect(repository.replaceTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          id: firstExpense.id,
          categoryId: 'CAFE',
          amountMinor: firstExpense.amountMinor,
          occurredOn: firstExpense.occurredOn,
          type: 'EXPENSE',
          importBatchId: firstExpense.importBatchId,
          importerId: firstExpense.importerId,
        }),
      );
    });
    expect(
      screen.getByRole('heading', {
        name: 'Fabricated second uncategorized expense',
      }),
    ).toBeVisible();
    expect(
      screen.getByText('☕ 카페 카테고리로 저장하고 다음 거래를 열었어요.'),
    ).toBeVisible();
  });

  it('groups matching uncategorized expenses after an explicit keyword and category choice', async () => {
    const user = userEvent.setup();
    const firstCoupangExpense: Transaction = {
      ...firstExpense,
      descriptionOriginal: 'Fabricated 쿠팡 오더 first expense',
    };
    const secondCoupangExpense: Transaction = {
      ...secondExpense,
      descriptionOriginal: 'Fabricated 쿠팡 second expense',
    };
    const categorizedCoupangExpense: Transaction = {
      ...categorizedExpense,
      descriptionOriginal: 'Fabricated 쿠팡 categorized expense',
    };
    const repository = createRepository([
      firstCoupangExpense,
      secondCoupangExpense,
      categorizedCoupangExpense,
    ]);

    render(<ReviewPage ledgerRepository={repository} />);

    await user.click(
      await screen.findByRole('button', { name: /비슷한 거래도 묶기/ }),
    );
    const dialog = screen.getByRole('dialog', { name: '비슷한 거래도 묶기' });
    expect(within(dialog).getByRole('heading', { name: '비슷한 거래도 묶기' })).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: '쿠팡' }));
    expect(within(dialog).getByText('현재 미분류 지출 2건')).toBeVisible();
    await user.click(within(dialog).getByRole('button', { name: '쇼핑' }));
    await user.click(within(dialog).getByRole('button', { name: '미분류 2건 묶기' }));

    await waitFor(() => {
      expect(
        repository.saveKeywordCategoryRuleAndReplaceTransactions,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ keywordNormalized: '쿠팡', categoryId: 'SHOPPING' }),
        [
          expect.objectContaining({ id: firstCoupangExpense.id, categoryId: 'SHOPPING' }),
          expect.objectContaining({ id: secondCoupangExpense.id, categoryId: 'SHOPPING' }),
        ],
      );
    });
    expect(
      await screen.findByRole('heading', {
        name: '카테고리 분류가 모두 끝났어요',
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/“쿠팡” 포함 미분류 지출 2건을 쇼핑으로 묶었어요/),
    ).toBeVisible();
  });

  it('closes the keyword grouping dialog with Escape and restores its trigger focus', async () => {
    const user = userEvent.setup();
    const repository = createRepository([
      {
        ...firstExpense,
        descriptionOriginal: 'Fabricated 쿠팡 order',
      },
    ]);

    render(<ReviewPage ledgerRepository={repository} />);

    const trigger = await screen.findByRole('button', {
      name: /비슷한 거래도 묶기/,
    });
    await user.click(trigger);
    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('heading', { name: '비슷한 거래도 묶기' }),
    ).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('keeps UNKNOWN outside the category queue and explains its limitation', async () => {
    render(<ReviewPage ledgerRepository={createRepository([unknownTransaction])} />);

    expect(
      await screen.findByRole('heading', {
        name: '카테고리 분류가 모두 끝났어요',
      }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: '거래 성격 확인 1건' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '거래 내역에서 보기' })).toHaveAttribute(
      'href',
      '/transactions',
    );
    expect(screen.queryByRole('button', { name: '카페' })).not.toBeInTheDocument();
  });

  it('shows a retryable local-storage failure', async () => {
    const listAllTransactions = vi
      .fn<ReviewLedgerRepository['listAllTransactions']>()
      .mockRejectedValueOnce(new Error('fabricated storage failure'))
      .mockResolvedValueOnce([firstExpense]);
    const repository: ReviewLedgerRepository = {
      listAllTransactions,
      getTransactionsByIds: async () => [],
      replaceTransaction: async () => undefined,
      saveKeywordCategoryRuleAndReplaceTransactions: async () => undefined,
    };
    const user = userEvent.setup();

    render(<ReviewPage ledgerRepository={repository} />);

    expect(
      await screen.findByText('분류할 거래를 불러오지 못했어요'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(
      await screen.findByText('Fabricated first uncategorized expense'),
    ).toBeVisible();
  });

  it('does not advance when the local category update fails', async () => {
    const user = userEvent.setup();
    const repository = createRepository([firstExpense, secondExpense]);
    repository.replaceTransaction.mockRejectedValueOnce(
      new Error('fabricated write failure'),
    );

    render(<ReviewPage ledgerRepository={repository} />);

    expect(
      await screen.findByText('Fabricated first uncategorized expense'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: '카페' }));

    expect(
      await screen.findByText(
        '카테고리를 저장하지 못했습니다. 이 기기의 저장소를 확인한 뒤 다시 시도해 주세요.',
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', {
        name: 'Fabricated first uncategorized expense',
      }),
    ).toBeVisible();
  });
});
