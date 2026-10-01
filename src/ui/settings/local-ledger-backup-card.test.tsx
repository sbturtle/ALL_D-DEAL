import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LocalLedgerSnapshot } from '../../domain/ledger-backup/local-ledger-backup';
import {
  createLocalLedgerBackup,
} from '../../domain/ledger-backup/local-ledger-backup';
import { DEFAULT_BUDGET_BUCKETS } from '../../domain/budget-buckets/budget-bucket';
import type { LocalLedgerBackupRepository } from '../../application/settings/manage-local-ledger-backup';
import { BrowserLedgerRepository } from '../../infrastructure/storage/browser-ledger-repository';
import { LocalLedgerBackupCard } from './local-ledger-backup-card';

const emptySnapshot: LocalLedgerSnapshot = {
  transactions: [],
  importBatches: [],
  budgetSettlements: [],
  categoryRules: [],
  keywordCategoryRules: [],
  userSettings: null,
  budgetBuckets: DEFAULT_BUDGET_BUCKETS,
  customCategories: [],
  transactionAttachments: [],
};

function createRepository(): BrowserLedgerRepository {
  return new BrowserLedgerRepository(
    `settings-backup-${crypto.randomUUID()}`,
    new IDBFactory(),
    IDBKeyRange,
  );
}

function makeBackup(snapshot: LocalLedgerSnapshot): string {
  return JSON.stringify(
    createLocalLedgerBackup(snapshot, '2026-08-31T01:00:00.000Z'),
  );
}

function makeJsonFile(contents: string, name: string): File {
  const file = new File([contents], name, { type: 'application/json' });
  Object.defineProperty(file, 'text', {
    value: () => Promise.resolve(contents),
  });
  return file;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('LocalLedgerBackupCard', () => {
  it('downloads a versioned snapshot created from the local repository', async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    const createObjectURL = vi.fn().mockReturnValue('blob:local-backup');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(
      <LocalLedgerBackupCard repository={repository} onRestored={vi.fn()} />,
    );
    await user.click(
      screen.getByRole('button', { name: '장부 백업 파일 내보내기' }),
    );

    expect(await screen.findByRole('status')).toBeVisible();
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    if (!(blob instanceof Blob)) {
      throw new Error('Backup download did not create a JSON Blob.');
    }
    expect(blob.type).toBe('application/json');
    expect(blob.size).toBeGreaterThan(0);
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-backup');
  });

  it('shows the selected backup contents before replacing the local ledger', async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    const outflowId = '550e8400-e29b-41d4-a716-446655440001';
    const restoredSnapshot: LocalLedgerSnapshot = {
      ...emptySnapshot,
      transactions: [
        {
          id: outflowId,
          occurredOn: '2026-08-30',
          amountMinor: 12_000,
          currency: 'KRW',
          direction: 'OUTFLOW',
          type: 'EXPENSE',
          budgetBucketId: 'LIVING',
          descriptionOriginal: '가짜 반려동물 용품점',
          createdAt: '2026-08-31T00:00:00.000Z',
          updatedAt: '2026-08-31T00:00:00.000Z',
        },
      ],
    };
    const onRestored = vi.fn();
    await repository.replaceLocalLedger(emptySnapshot);

    render(
      <LocalLedgerBackupCard repository={repository} onRestored={onRestored} />,
    );
    await user.upload(
      screen.getByLabelText('복원할 장부 백업 JSON 파일'),
      makeJsonFile(makeBackup(restoredSnapshot), 'private-statement.json'),
    );

    const confirmation = await screen.findByRole('region', {
      name: '복원할 장부 내용',
    });
    expect(within(confirmation).getByText('1건')).toBeVisible();
    expect(
      screen.queryByText('private-statement.json'),
    ).not.toBeInTheDocument();
    await expect(repository.getLocalLedgerSnapshot()).resolves.toEqual(
      emptySnapshot,
    );

    await user.click(
      within(confirmation).getByRole('button', {
        name: '이 백업으로 장부 교체',
      }),
    );

    await expect(repository.getLocalLedgerSnapshot()).resolves.toEqual(
      restoredSnapshot,
    );
    expect(onRestored).toHaveBeenCalledWith(
      expect.objectContaining({ data: restoredSnapshot }),
    );
    expect(await screen.findByRole('status')).toBeVisible();
  });

  it('leaves the local ledger untouched when the selected file is invalid', async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    await repository.replaceLocalLedger(emptySnapshot);

    render(
      <LocalLedgerBackupCard repository={repository} onRestored={vi.fn()} />,
    );
    await user.upload(
      screen.getByLabelText('복원할 장부 백업 JSON 파일'),
      makeJsonFile('{"format":"unrecognized"}', 'private-file.json'),
    );

    expect(await screen.findByRole('alert')).toBeVisible();
    expect(
      screen.queryByRole('region', { name: '복원할 장부 내용' }),
    ).not.toBeInTheDocument();
    await expect(repository.getLocalLedgerSnapshot()).resolves.toEqual(
      emptySnapshot,
    );
  });

  it('keeps the confirmation available and reports storage failure', async () => {
    const user = userEvent.setup();
    const repository: LocalLedgerBackupRepository = {
      getLocalLedgerSnapshot: vi.fn().mockResolvedValue(emptySnapshot),
      replaceLocalLedger: vi.fn().mockRejectedValue(new Error('storage failed')),
    };

    render(
      <LocalLedgerBackupCard repository={repository} onRestored={vi.fn()} />,
    );
    await user.upload(
      screen.getByLabelText('복원할 장부 백업 JSON 파일'),
      makeJsonFile(makeBackup(emptySnapshot), 'private-file.json'),
    );
    const confirmation = await screen.findByRole('region', {
      name: '복원할 장부 내용',
    });
    await user.click(
      within(confirmation).getByRole('button', {
        name: '이 백업으로 장부 교체',
      }),
    );

    expect(await screen.findByRole('alert')).toBeVisible();
    expect(
      screen.getByRole('region', { name: '복원할 장부 내용' }),
    ).toBeVisible();
  });
});
