import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Transaction } from '../../domain/transactions/transaction';
import type { LocalLedgerRepository } from './dashboard-section';
import { DashboardSection } from './dashboard-section';

const payer: Transaction = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  occurredOn: '2026-08-03',
  amountMinor: 90_000,
  currency: 'KRW',
  direction: 'OUTFLOW',
  type: 'UNKNOWN',
  descriptionOriginal: 'Fabricated group payment',
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
};
const reimbursement: Transaction = {
  id: '550e8400-e29b-41d4-a716-446655440002',
  occurredOn: '2026-08-06',
  amountMinor: 60_000,
  currency: 'KRW',
  direction: 'INFLOW',
  type: 'UNKNOWN',
  descriptionOriginal: 'Fabricated reimbursement',
  createdAt: '2026-08-06T00:00:00.000Z',
  updatedAt: '2026-08-06T00:00:00.000Z',
};
const ordinaryExpense: Transaction = {
  id: '550e8400-e29b-41d4-a716-446655440003',
  occurredOn: '2026-08-04',
  amountMinor: 20_000,
  currency: 'KRW',
  direction: 'OUTFLOW',
  type: 'EXPENSE',
  categoryId: 'TRANSPORT',
  descriptionOriginal: 'Fabricated ordinary expense',
  importBatchId: '550e8400-e29b-41d4-a716-446655440000',
  importerId: 'LEGACY_XLS',
  createdAt: '2026-08-04T00:00:00.000Z',
  updatedAt: '2026-08-04T00:00:00.000Z',
};
const classifiedIncome: Transaction = {
  ...reimbursement,
  id: '550e8400-e29b-41d4-a716-446655440004',
  type: 'INCOME',
  descriptionOriginal: 'Fabricated classified income',
};
const classifiedTransfer: Transaction = {
  ...payer,
  id: '550e8400-e29b-41d4-a716-446655440005',
  type: 'TRANSFER',
  descriptionOriginal: 'Fabricated classified transfer',
};
const categorizedUnknown: Transaction = {
  ...payer,
  id: '550e8400-e29b-41d4-a716-446655440006',
  categoryId: 'OTHER',
  descriptionOriginal: 'Fabricated unresolved unknown',
};
const uncategorizedExpense: Transaction = {
  id: '550e8400-e29b-41d4-a716-446655440007',
  occurredOn: '2026-08-02',
  amountMinor: 15_000,
  currency: 'KRW',
  direction: 'OUTFLOW',
  type: 'EXPENSE',
  descriptionOriginal: 'Fabricated uncategorized expense',
  createdAt: '2026-08-02T00:00:00.000Z',
  updatedAt: '2026-08-02T00:00:00.000Z',
};

const repository: LocalLedgerRepository = {
  listTransactionsInRange: vi.fn().mockResolvedValue([
    reimbursement,
    ordinaryExpense,
    payer,
  ]),
  listAllTransactions: vi.fn().mockResolvedValue([
    reimbursement,
    ordinaryExpense,
    payer,
  ]),
  getTransactionsByIds: vi.fn().mockResolvedValue([]),
  listBudgetSettlements: vi.fn().mockResolvedValue([
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      payerOutflowTransactionId: payer.id,
      reimbursementInflowTransactionIds: [reimbursement.id],
      createdAt: '2026-08-06T00:00:00.000Z',
      updatedAt: '2026-08-06T00:00:00.000Z',
    },
  ]),
  saveBudgetSettlement: vi.fn().mockResolvedValue(undefined),
  removeBudgetSettlement: vi.fn().mockResolvedValue(undefined),
  replaceTransaction: vi.fn().mockResolvedValue(undefined),
  getLocalUserSettings: vi.fn().mockResolvedValue(undefined),
};

function getTodayInSeoulForTest(): Transaction['occurredOn'] {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));

  return `${valueByType.get('year')}-${valueByType.get('month')}-${valueByType.get('day')}` as Transaction['occurredOn'];
}

function createHomeRepository(
  transactions: readonly Transaction[],
  settings: Awaited<ReturnType<LocalLedgerRepository['getLocalUserSettings']>> =
    undefined,
): LocalLedgerRepository {
  return {
    ...repository,
    listTransactionsInRange: vi.fn().mockResolvedValue(transactions),
    listAllTransactions: vi.fn().mockResolvedValue(transactions),
    listBudgetSettlements: vi.fn().mockResolvedValue([]),
    getLocalUserSettings: vi.fn().mockResolvedValue(settings),
  };
}

describe('DashboardSection', () => {
  it('shows actual monthly goal, review count, weekly spending, and recent transactions on HOME', async () => {
    const occurredOn = getTodayInSeoulForTest();
    const homeExpense: Transaction = {
      ...ordinaryExpense,
      id: '550e8400-e29b-41d4-a716-446655440011',
      occurredOn,
      amountMinor: 20_000,
      descriptionOriginal: 'Fabricated home expense',
    };
    const homeReviewNeeded: Transaction = {
      ...payer,
      id: '550e8400-e29b-41d4-a716-446655440012',
      occurredOn,
      amountMinor: 10_000,
      type: 'EXPENSE',
      descriptionOriginal: 'Fabricated review needed',
    };
    const homeRepository = createHomeRepository(
      [
        homeExpense,
        homeReviewNeeded,
        classifiedIncome,
        classifiedTransfer,
        categorizedUnknown,
      ],
      {
        id: 'current',
        monthlyLivingExpenseGoalMinor: 50_000,
        updatedAt: '2026-08-05T00:00:00.000Z',
      },
    );

    render(<DashboardSection ledgerRepository={homeRepository} page="HOME" />);

    expect(
      await screen.findByRole('heading', {
        name: '이번 달 생활비를 한눈에 확인하세요',
      }),
    ).toBeVisible();
    expect(await screen.findByText('30,000원')).toBeVisible();
    expect(screen.getByText('20,000원 남았어요')).toBeVisible();
    expect(
      screen.getByRole('progressbar', { name: '월 생활비 목표 사용률' }),
    ).toHaveAttribute('aria-valuenow', '60');
    expect(screen.getByText('분류가 필요한 거래 2건')).toBeVisible();
    expect(
      within(
        screen.getByRole('list', { name: '최근 7일 생활비 막대 그래프' }),
      ).getAllByRole('listitem'),
    ).toHaveLength(7);
    expect(
      screen.getByRole('listitem', {
        name: `${occurredOn} 생활비 30,000원`,
      }),
    ).toBeVisible();
    expect(screen.getByText('Fabricated home expense')).toBeVisible();
    expect(screen.getByText('Fabricated review needed')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: '최근 1주' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '공동결제 정산' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText('장부 보기 선택')).not.toBeInTheDocument();
  });

  it('shows honest HOME empty and goal guidance without fabricated values', async () => {
    render(
      <DashboardSection
        ledgerRepository={createHomeRepository([])}
        page="HOME"
      />,
    );

    expect(
      await screen.findByRole('heading', {
        name: '월 생활비 목표가 아직 없어요',
      }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: '생활비 목표 설정하기' })).toHaveAttribute(
      'href',
      '/settings',
    );
    expect(screen.getByText('분류가 필요한 거래가 없어요')).toBeVisible();
    expect(screen.getByText('이번 달 거래가 아직 없어요')).toBeVisible();
  });

  it('announces HOME loading while local data is pending', () => {
    const pendingRepository: LocalLedgerRepository = {
      ...repository,
      listTransactionsInRange: vi.fn(
        () =>
          new Promise<readonly Transaction[]>(() => {
            // Intentionally pending so the loading state remains observable.
          }),
      ),
    };

    render(<DashboardSection ledgerRepository={pendingRepository} page="HOME" />);

    expect(screen.getByRole('status')).toHaveTextContent(
      '이번 달 장부를 불러오는 중이에요',
    );
    expect(screen.queryByText('이번 달 생활비')).not.toBeInTheDocument();
  });

  it('shows a retryable HOME error instead of zero-value summaries', async () => {
    const failingRepository: LocalLedgerRepository = {
      ...repository,
      listTransactionsInRange: vi.fn().mockRejectedValue(new Error('failed')),
    };

    render(<DashboardSection ledgerRepository={failingRepository} page="HOME" />);

    expect(
      await screen.findByRole('alert'),
    ).toHaveTextContent('홈 요약을 불러오지 못했어요');
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
    expect(screen.queryByText('이번 달 생활비')).not.toBeInTheDocument();
  });

  it('shows period controls and the net shared-payment living expense', async () => {
    const user = userEvent.setup();
    render(
      <DashboardSection
        ledgerRepository={repository}
      />,
    );

    expect(await screen.findByText('Fabricated group payment')).toBeVisible();
    expect(screen.getByText('2026-08-04 · 지출 · 🚇 교통')).toBeVisible();
    expect(screen.getByText('50,000원')).toBeVisible();
    expect(screen.getByText('공동결제 순지출 1건 반영')).toBeVisible();
    expect(screen.getByRole('button', { name: '최근 1주' })).toBeVisible();
    expect(screen.getByLabelText('장부 보기 선택')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '직접 선택' }));
    expect(screen.getByLabelText('기간 시작')).toBeVisible();
    expect(screen.getByLabelText('기간 종료')).toBeVisible();
  });

  it('filters saved transactions by outflow, inflow, and review-needed state', async () => {
    const user = userEvent.setup();
    const filterRepository: LocalLedgerRepository = {
      ...repository,
      listTransactionsInRange: vi.fn().mockResolvedValue([
        classifiedIncome,
        classifiedTransfer,
        categorizedUnknown,
        uncategorizedExpense,
        ordinaryExpense,
      ]),
      listAllTransactions: vi.fn().mockResolvedValue([
        classifiedIncome,
        classifiedTransfer,
        categorizedUnknown,
        uncategorizedExpense,
        ordinaryExpense,
      ]),
    };
    render(<DashboardSection ledgerRepository={filterRepository} />);

    await screen.findByText('Fabricated ordinary expense');
    const filters = screen.getByRole('group', { name: '거래 필터' });

    await user.click(within(filters).getByRole('button', { name: '수입' }));
    expect(screen.getByText('Fabricated classified income')).toBeVisible();
    expect(screen.queryByText('Fabricated ordinary expense')).not.toBeInTheDocument();
    expect(screen.queryByText('Fabricated classified transfer')).not.toBeInTheDocument();

    await user.click(within(filters).getByRole('button', { name: '지출' }));
    expect(screen.getByText('Fabricated ordinary expense')).toBeVisible();
    expect(screen.getByText('Fabricated classified transfer')).toBeVisible();
    expect(screen.queryByText('Fabricated classified income')).not.toBeInTheDocument();

    await user.click(
      within(filters).getByRole('button', { name: '확인 필요' }),
    );
    expect(screen.getByText('Fabricated unresolved unknown')).toBeVisible();
    expect(screen.getByText('Fabricated uncategorized expense')).toBeVisible();
    expect(screen.queryByText('Fabricated classified income')).not.toBeInTheDocument();
    expect(screen.queryByText('Fabricated classified transfer')).not.toBeInTheDocument();
    expect(screen.queryByText('Fabricated ordinary expense')).not.toBeInTheDocument();
  });

  it('shows the monthly goal remaining after shared-payment net spending', async () => {
    const user = userEvent.setup();
    const monthlyGoalRepository: LocalLedgerRepository = {
      ...repository,
      getLocalUserSettings: vi.fn().mockResolvedValue({
        id: 'current',
        monthlyLivingExpenseGoalMinor: 80_000,
        updatedAt: '2026-08-05T00:00:00.000Z',
      }),
    };
    render(<DashboardSection ledgerRepository={monthlyGoalRepository} />);

    expect(await screen.findByText('월 목표 잔액')).toBeVisible();
    expect(screen.getByText('30,000원')).toBeVisible();
    expect(
      screen.getByText('목표 80,000원 · 순생활비 50,000원'),
    ).toBeVisible();

    await user.click(screen.getByRole('button', { name: '최근 1주' }));
    expect(
      await screen.findByText(
        '월 생활비 목표는 월간 보기에서만 계산합니다. 현재 선택 기간에는 실제 사용액만 표시합니다.',
      ),
    ).toBeVisible();
    expect(screen.queryByText('월 목표 잔액')).not.toBeInTheDocument();
  });

  it('updates one saved transaction category and memo from the ledger', async () => {
    const user = userEvent.setup();
    const replaceTransaction = vi.fn().mockResolvedValue(undefined);
    const updateRepository: LocalLedgerRepository = {
      ...repository,
      getTransactionsByIds: vi.fn().mockResolvedValue([ordinaryExpense]),
      replaceTransaction,
    };
    render(<DashboardSection ledgerRepository={updateRepository} />);

    await screen.findByText('Fabricated ordinary expense');
    await user.click(
      screen.getByRole('button', {
        name: 'Fabricated ordinary expense 카테고리·메모 수정',
      }),
    );
    await user.selectOptions(
      screen.getByLabelText('Fabricated ordinary expense 카테고리'),
      'CAFE',
    );
    await user.type(
      screen.getByLabelText('Fabricated ordinary expense 메모'),
      'Fabricated memo',
    );
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(replaceTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ordinaryExpense.id,
        categoryId: 'CAFE',
        memo: 'Fabricated memo',
        importBatchId: ordinaryExpense.importBatchId,
      }),
    );
    expect(await screen.findByText('메모: Fabricated memo')).toBeVisible();
    expect(screen.getByText('2026-08-04 · 지출 · ☕ 카페')).toBeVisible();
  });

  it('opens transaction editing as an accessible bottom sheet and restores focus on Escape', async () => {
    const user = userEvent.setup();
    render(<DashboardSection ledgerRepository={repository} />);

    await screen.findByText('Fabricated ordinary expense');
    const trigger = screen.getByRole('button', {
      name: 'Fabricated ordinary expense 카테고리·메모 수정',
    });
    await user.click(trigger);

    expect(
      screen.getByRole('dialog', { name: 'Fabricated ordinary expense' }),
    ).toBeVisible();
    expect(
      screen.getByLabelText('Fabricated ordinary expense 카테고리'),
    ).toHaveFocus();
    expect(
      screen.getByRole('button', {
        name: 'Fabricated ordinary expense 수정 닫기',
      }),
    ).toBeVisible();
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');

    expect(
      screen.queryByRole('dialog', { name: 'Fabricated ordinary expense' }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body.style.overflow).toBe('');

    await user.click(trigger);
    const reopenedDialog = screen.getByRole('dialog', {
      name: 'Fabricated ordinary expense',
    });
    const backdrop = reopenedDialog.parentElement;
    expect(backdrop).not.toBeNull();
    fireEvent.mouseDown(backdrop as HTMLElement);

    expect(
      screen.queryByRole('dialog', { name: 'Fabricated ordinary expense' }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
