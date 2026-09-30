import type { LocalFinanceDirectoryPickResult } from '../../application/imports/local-finance-directory-import';

// File System Access API 중 폴더 선택과 파일 목록 읽기만 쓴다. 표준 TypeScript DOM
// 타입에 `showDirectoryPicker`가 없어 필요한 표면만 정의한다.

type LocalFileHandle = Readonly<{
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
}>;

type LocalDirectoryEntry =
  | LocalFileHandle
  | Readonly<{
      kind: 'directory';
      name: string;
    }>;

export type LocalDirectoryHandle = Readonly<{
  values: () => AsyncIterable<LocalDirectoryEntry>;
}>;

type DirectoryPickerOptions = Readonly<{
  id?: string;
  mode?: 'read';
  startIn?: 'downloads';
}>;

type DirectoryPickerWindow = Window &
  Readonly<{
    showDirectoryPicker?: (options?: DirectoryPickerOptions) => Promise<LocalDirectoryHandle>;
  }>;

export type LocalFinanceDirectoryPicker = () => Promise<LocalDirectoryHandle>;

function isLegacyXlsFileName(fileName: string): boolean {
  return /\.xls$/i.test(fileName);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** 하위 폴더는 보지 않고 최상위 `.xls` 중 수정 시각이 가장 늦은 파일 하나를 고른다. */
export async function findLatestLegacyXlsFile(
  directory: LocalDirectoryHandle,
): Promise<File | undefined> {
  let latestFile: File | undefined;

  for await (const entry of directory.values()) {
    if (entry.kind !== 'file' || !isLegacyXlsFileName(entry.name)) {
      continue;
    }

    const file = await entry.getFile();
    if (latestFile === undefined || file.lastModified > latestFile.lastModified) {
      latestFile = file;
    }
  }

  return latestFile;
}

function getDefaultDirectoryPicker(): LocalFinanceDirectoryPicker | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const pickerWindow: DirectoryPickerWindow = window;
  const showDirectoryPicker = pickerWindow.showDirectoryPicker?.bind(window);

  if (showDirectoryPicker === undefined) {
    return undefined;
  }

  return () =>
    showDirectoryPicker({
      id: 'all-d-deal-finance-import',
      mode: 'read',
      startIn: 'downloads',
    });
}

export function canPickLocalFinanceDirectory(): boolean {
  return getDefaultDirectoryPicker() !== undefined;
}

/**
 * 사용자가 고른 폴더에서 최신 XLS를 찾는다. 선택 취소는 CANCELLED, XLS가 없으면
 * EMPTY로 돌려주고, 권한 거부 같은 그 밖의 오류는 호출자가 일반화된 안내로 바꾼다.
 */
export async function pickLatestLocalFinanceXls(
  picker: LocalFinanceDirectoryPicker | undefined = getDefaultDirectoryPicker(),
): Promise<LocalFinanceDirectoryPickResult> {
  if (picker === undefined) {
    throw new Error('Local directory picker is unavailable.');
  }

  try {
    const directory = await picker();
    const file = await findLatestLegacyXlsFile(directory);

    return file === undefined ? { status: 'EMPTY' } : { status: 'SELECTED', file };
  } catch (error) {
    if (isAbortError(error)) {
      return { status: 'CANCELLED' };
    }

    throw error;
  }
}
