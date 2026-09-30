import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { LatestLocalFinanceXlsPicker } from '../../application/imports/local-finance-directory-import';
import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import { LegacyXlsImportPreview } from './legacy-xls-import-preview';

const FOLDER_BUTTON_NAME = '로컬 금융 폴더에서 최신 XLS 불러오기';

const preview: ImportPreview = {
  source: 'CARD_USAGE_XLS',
  candidates: [
    {
      source: 'CARD_USAGE_XLS',
      rowNumber: 2,
      draft: {
        occurredOn: '2026-09-30',
        amountMinor: 12_000,
        currency: 'KRW',
        direction: 'OUTFLOW',
        type: 'EXPENSE',
        budgetBucketId: 'LIVING',
        descriptionOriginal: '가짜 식당',
      },
    },
  ],
  issues: [],
};

function renderWithPicker(picker: LatestLocalFinanceXlsPicker) {
  const previewFile = vi.fn().mockResolvedValue(preview);
  render(<LegacyXlsImportPreview previewFile={previewFile} pickLatestLocalFinanceXls={picker} />);
  return previewFile;
}

describe('local finance directory import', () => {
  it('passes the latest XLS from the chosen folder to the existing Preview flow', async () => {
    const user = userEvent.setup();
    const file = new File(['가짜'], 'private-card-2026.xls', { type: 'application/vnd.ms-excel' });
    const previewFile = renderWithPicker(async () => ({ status: 'SELECTED', file }));

    await user.click(screen.getByRole('button', { name: FOLDER_BUTTON_NAME }));

    expect(previewFile).toHaveBeenCalledWith(file);
    expect(await screen.findByRole('heading', { name: '1건을 찾았어요' })).toBeVisible();
    expect(screen.queryByText(/private-card-2026/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: FOLDER_BUTTON_NAME }),
    ).toHaveAccessibleDescription(/다운로드 폴더 자체는 선택할 수 없어요/);
  });

  it('keeps the start state when the folder picker is cancelled', async () => {
    const user = userEvent.setup();
    const previewFile = renderWithPicker(async () => ({ status: 'CANCELLED' }));

    await user.click(screen.getByRole('button', { name: FOLDER_BUTTON_NAME }));

    expect(previewFile).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: '소비 내역 파일을 선택해 주세요' })).toBeVisible();
    expect(screen.queryByText(/찾지 못했습니다|읽지 못했습니다/)).not.toBeInTheDocument();
  });

  it('explains an empty folder without revealing a path or file name', async () => {
    const user = userEvent.setup();
    renderWithPicker(async () => ({ status: 'EMPTY' }));

    await user.click(screen.getByRole('button', { name: FOLDER_BUTTON_NAME }));

    expect(screen.getByText('선택한 폴더에서 XLS 파일을 찾지 못했습니다.')).toBeVisible();
  });

  it('shows a generalized message when the folder cannot be read', async () => {
    const user = userEvent.setup();
    renderWithPicker(async () => {
      throw new DOMException('C:\\가짜\\금융 폴더 denied', 'NotAllowedError');
    });

    await user.click(screen.getByRole('button', { name: FOLDER_BUTTON_NAME }));

    expect(
      screen.getByText('폴더를 읽지 못했습니다. 파일 선택하기로 계속할 수 있습니다.'),
    ).toBeVisible();
    expect(screen.queryByText(/가짜\\금융 폴더/)).not.toBeInTheDocument();
  });

  it('hides the folder button when the browser cannot pick folders', () => {
    render(<LegacyXlsImportPreview previewFile={async () => preview} />);

    expect(screen.queryByRole('button', { name: FOLDER_BUTTON_NAME })).not.toBeInTheDocument();
    expect(screen.getByLabelText('XLS 파일 선택')).toBeInTheDocument();
  });
});
