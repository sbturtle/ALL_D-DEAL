import { render, screen } from '@testing-library/react';
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

describe('DashboardSection', () => {
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

    await user.click(screen.getByRole('button', { name: '직접 선택' }));
    expect(screen.getByLabelText('기간 시작')).toBeVisible();
    expect(screen.getByLabelText('기간 종료')).toBeVisible();
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
});
