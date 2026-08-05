import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import { LegacyXlsImportPreview } from './legacy-xls-import-preview';

const accountPreview: ImportPreview = {
  source: 'ACCOUNT_LEDGER_XLS',
  candidates: [
    {
      source: 'ACCOUNT_LEDGER_XLS',
      rowNumber: 5,
      draft: {
        occurredOn: '2026-08-01',
        amountMinor: 15_000,
        currency: 'KRW',
        direction: 'OUTFLOW',
        type: 'UNKNOWN',
        descriptionOriginal: '가짜 식료품점',
      },
    },
  ],
  issues: [
    {
      source: 'ACCOUNT_LEDGER_XLS',
      rowNumber: 7,
      code: 'invalid_amount',
      message: '입금 또는 출금 금액을 하나만 확인할 수 있어야 합니다.',
    },
  ],
};

describe('LegacyXlsImportPreview', () => {
  it('선택한 XLS의 후보와 원본 값 없는 확인 필요 사유를 미리보기로 보여준다', async () => {
    const user = userEvent.setup();
    const previewFile = vi.fn().mockResolvedValue(accountPreview);
    render(<LegacyXlsImportPreview previewFile={previewFile} />);

    const file = new File(['fake'], 'private-account.xls', {
      type: 'application/vnd.ms-excel',
    });
    await user.upload(screen.getByLabelText('XLS 파일 선택'), file);

    expect(previewFile).toHaveBeenCalledWith(file);
    expect(screen.getByText('계좌 거래 XLS · 후보 1건 · 확인 필요 1건')).toBeVisible();
    expect(screen.getByText('가짜 식료품점')).toBeVisible();
    expect(screen.getByText('유형 확인 필요 · 출금')).toBeVisible();
    expect(screen.getByText('−15,000원')).toBeVisible();
    expect(
      screen.getByText('7행 · 입금 또는 출금 금액을 하나만 확인할 수 있어야 합니다.'),
    ).toBeVisible();
    expect(screen.queryByText('private-account.xls')).not.toBeInTheDocument();
  });

  it('파일 읽기 실패를 일반화된 안내로 보여주고 파일명을 노출하지 않는다', async () => {
    const user = userEvent.setup();
    const previewFile = vi.fn().mockRejectedValue(new Error('raw private failure'));
    render(<LegacyXlsImportPreview previewFile={previewFile} />);

    const file = new File(['fake'], 'private-card.xls', {
      type: 'application/vnd.ms-excel',
    });
    await user.upload(screen.getByLabelText('XLS 파일 선택'), file);

    expect(screen.getByText(/파일을 읽는 중 문제가 발생했습니다/)).toBeVisible();
    expect(screen.queryByText('private-card.xls')).not.toBeInTheDocument();
    expect(screen.queryByText('raw private failure')).not.toBeInTheDocument();
  });

  it('지우기를 누르면 Preview 상태를 제거하고 저장 동작을 만들지 않는다', async () => {
    const user = userEvent.setup();
    render(<LegacyXlsImportPreview previewFile={async () => accountPreview} />);

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    await user.click(screen.getByRole('button', { name: '지우기' }));

    expect(screen.queryByText('가져오기 검토')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Preview 후 사용자가 확인한 후보만 이 기기에 저장합니다/),
    ).toBeVisible();
  });

  it('사용자가 명시적으로 확인한 후보만 로컬 저장을 요청한다', async () => {
    const user = userEvent.setup();
    const confirmPreview = vi.fn().mockResolvedValue({
      isConfirmed: true,
      batch: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        importerId: 'LEGACY_XLS',
        importerVersion: 1,
        sourceType: 'ACCOUNT_LEDGER_XLS',
        committedAt: '2026-08-05T00:00:00.000Z',
        newCount: 1,
        skippedCount: 0,
        reviewedCount: 1,
      },
      transactions: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          ...accountPreview.candidates[0].draft,
          importBatchId: '550e8400-e29b-41d4-a716-446655440000',
          importerId: 'LEGACY_XLS',
          createdAt: '2026-08-05T00:00:00.000Z',
          updatedAt: '2026-08-05T00:00:00.000Z',
        },
      ],
    });
    render(
      <LegacyXlsImportPreview
        previewFile={async () => accountPreview}
        confirmPreview={confirmPreview}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    expect(confirmPreview).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: '후보 1건을 이 기기에 저장' }),
    );

    expect(confirmPreview).toHaveBeenCalledWith(accountPreview, { skippedCount: 0 });
    expect(await screen.findByText('1건을 이 기기에 저장했습니다.')).toBeVisible();
  });

  it('defaults a possible duplicate to excluded and allows an individual re-include', async () => {
    const user = userEvent.setup();
    const confirmPreview = vi.fn().mockResolvedValue({
      isConfirmed: true,
      batch: {},
      transactions: [],
    });
    const findPotentialDuplicates = vi.fn().mockResolvedValue([
      {
        candidateIndex: 0,
        savedTransactionIds: ['550e8400-e29b-41d4-a716-446655440099'],
        previewCandidateIndexes: [],
      },
    ]);
    render(
      <LegacyXlsImportPreview
        previewFile={async () => accountPreview}
        findPotentialDuplicates={findPotentialDuplicates}
        confirmPreview={confirmPreview}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );

    const candidateCheckbox = await screen.findByRole('checkbox', {
      name: '중복 가능 후보 1 저장',
    });
    expect(candidateCheckbox).not.toBeChecked();
    expect(screen.getByTestId('import-confirm-action')).toBeDisabled();

    await user.click(candidateCheckbox);
    await user.click(screen.getByTestId('import-confirm-action'));

    expect(confirmPreview).toHaveBeenCalledWith(accountPreview, { skippedCount: 0 });
  });

  it('can include all possible duplicates before confirmation', async () => {
    const user = userEvent.setup();
    const confirmPreview = vi.fn().mockResolvedValue({
      isConfirmed: false,
      code: 'nothing_to_save',
    });
    render(
      <LegacyXlsImportPreview
        previewFile={async () => accountPreview}
        findPotentialDuplicates={async () => [
          {
            candidateIndex: 0,
            savedTransactionIds: [],
            previewCandidateIndexes: [],
          },
        ]}
        confirmPreview={confirmPreview}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    await user.click(
      await screen.findByRole('button', {
        name: '중복 가능 후보 모두 저장에 포함',
      }),
    );

    expect(screen.getByRole('checkbox', { name: '중복 가능 후보 1 저장' })).toBeChecked();
    await user.click(screen.getByTestId('import-confirm-action'));
    expect(confirmPreview).toHaveBeenCalledWith(accountPreview, { skippedCount: 0 });
  });

  it('stores a changed category and a separately confirmed future rule', async () => {
    const user = userEvent.setup();
    const confirmPreview = vi.fn().mockResolvedValue({
      isConfirmed: false,
      code: 'nothing_to_save',
    });
    render(
      <LegacyXlsImportPreview
        previewFile={async () => accountPreview}
        confirmPreview={confirmPreview}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    await user.selectOptions(
      await screen.findByLabelText('후보 1 카테고리'),
      'FOOD_DINING',
    );
    await user.click(screen.getByLabelText('후보 1 카테고리 규칙 저장'));
    await user.click(screen.getByTestId('import-confirm-action'));

    const [selectedPreview, options] = confirmPreview.mock.calls[0] ?? [];
    expect(selectedPreview.candidates[0].draft.categoryId).toBe('FOOD_DINING');
    expect(options).toEqual({
      skippedCount: 0,
      categoryRuleRequests: [
        expect.objectContaining({ categoryId: 'FOOD_DINING' }),
      ],
    });
  });

  it('does not allow an excluded possible duplicate to create a category rule', async () => {
    const user = userEvent.setup();
    render(
      <LegacyXlsImportPreview
        previewFile={async () => accountPreview}
        findPotentialDuplicates={async () => [
          {
            candidateIndex: 0,
            savedTransactionIds: ['550e8400-e29b-41d4-a716-446655440099'],
            previewCandidateIndexes: [],
          },
        ]}
      />,
    );

    await user.upload(
      screen.getByLabelText('XLS 파일 선택'),
      new File(['fake'], 'fake.xls', { type: 'application/vnd.ms-excel' }),
    );
    await user.selectOptions(
      await screen.findByLabelText('후보 1 카테고리'),
      'FOOD_DINING',
    );

    expect(screen.getByLabelText('후보 1 카테고리 규칙 저장')).toBeDisabled();
  });
});
