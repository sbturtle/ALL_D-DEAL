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
  descriptionOriginal: 'Fabricated ordinary expense',
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
};

describe('DashboardSection', () => {
  it('shows period controls and the net shared-payment living expense', async () => {
    const user = userEvent.setup();
    render(
      <DashboardSection
        previewLegacyXls={vi.fn()}
        confirmLegacyXlsImport={vi.fn()}
        findPotentialLegacyXlsImportDuplicates={vi.fn().mockResolvedValue([])}
        ledgerRepository={repository}
      />,
    );

    expect(await screen.findByText('Fabricated group payment')).toBeVisible();
    expect(screen.getByText('50,000원')).toBeVisible();
    expect(screen.getByText('공동결제 순지출 1건 반영')).toBeVisible();
    expect(screen.getByRole('button', { name: '최근 1주' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: '직접 선택' }));
    expect(screen.getByLabelText('기간 시작')).toBeVisible();
    expect(screen.getByLabelText('기간 종료')).toBeVisible();
  });
});
