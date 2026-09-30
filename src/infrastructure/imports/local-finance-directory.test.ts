import { describe, expect, it } from 'vitest';

import {
  findLatestLegacyXlsFile,
  pickLatestLocalFinanceXls,
  type LocalDirectoryHandle,
  type LocalFinanceDirectoryPicker,
} from './local-finance-directory';

type FakeEntry = Readonly<
  { kind: 'directory'; name: string } | { kind: 'file'; name: string; file: File }
>;

function createDirectory(entries: readonly FakeEntry[]): LocalDirectoryHandle {
  return {
    async *values() {
      for (const entry of entries) {
        yield entry.kind === 'directory'
          ? entry
          : { kind: 'file' as const, name: entry.name, getFile: async () => entry.file };
      }
    },
  };
}

function fakeFile(name: string, lastModified: number): File {
  return new File(['가짜'], name, { type: 'application/vnd.ms-excel', lastModified });
}

describe('findLatestLegacyXlsFile', () => {
  it('picks the most recently modified top-level XLS and ignores other formats and folders', async () => {
    const older = fakeFile('fake-account.xls', 100);
    const newer = fakeFile('FAKE-CARD.XLS', 200);

    const file = await findLatestLegacyXlsFile(
      createDirectory([
        { kind: 'file', name: older.name, file: older },
        { kind: 'file', name: 'fake.xlsx', file: fakeFile('fake.xlsx', 300) },
        { kind: 'directory', name: 'archive' },
        { kind: 'file', name: newer.name, file: newer },
      ]),
    );

    expect(file).toBe(newer);
  });

  it('skips the Excel owner file created while the XLS is open', async () => {
    const statement = fakeFile('fake-card.xls', 100);
    const ownerFile = fakeFile('~$ke-card.xls', 200);

    const file = await findLatestLegacyXlsFile(
      createDirectory([
        { kind: 'file', name: statement.name, file: statement },
        { kind: 'file', name: ownerFile.name, file: ownerFile },
      ]),
    );

    expect(file).toBe(statement);
  });

  it('returns nothing when only an Excel owner file remains', async () => {
    const file = await findLatestLegacyXlsFile(
      createDirectory([{ kind: 'file', name: '~$fake.xls', file: fakeFile('~$fake.xls', 1) }]),
    );

    expect(file).toBeUndefined();
  });
});

describe('pickLatestLocalFinanceXls', () => {
  it('returns EMPTY when the folder has no XLS', async () => {
    const picker: LocalFinanceDirectoryPicker = async () =>
      createDirectory([{ kind: 'file', name: 'fake.xlsx', file: fakeFile('fake.xlsx', 1) }]);

    await expect(pickLatestLocalFinanceXls(picker)).resolves.toEqual({ status: 'EMPTY' });
  });

  it('treats a cancelled picker as CANCELLED', async () => {
    const picker: LocalFinanceDirectoryPicker = async () => {
      throw new DOMException('cancelled', 'AbortError');
    };

    await expect(pickLatestLocalFinanceXls(picker)).resolves.toEqual({ status: 'CANCELLED' });
  });

  it('rethrows permission errors for the caller to generalize', async () => {
    const picker: LocalFinanceDirectoryPicker = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };

    await expect(pickLatestLocalFinanceXls(picker)).rejects.toMatchObject({
      name: 'NotAllowedError',
    });
  });

  it('fails clearly when the browser has no directory picker', async () => {
    await expect(pickLatestLocalFinanceXls(undefined)).rejects.toThrow(
      'Local directory picker is unavailable.',
    );
  });
});
