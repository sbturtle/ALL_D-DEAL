import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';

import {
  MAX_LEGACY_XLS_FILE_BYTES,
  previewLegacyXlsArrayBuffer,
  previewLegacyXlsFile,
} from './legacy-xls-file-reader';

function createWorkbookData(rows: readonly (readonly unknown[])[]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(rows.map((row) => [...row]));

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Import');

  return XLSX.write(workbook, { bookType: 'biff8', type: 'array' });
}

describe('previewLegacyXlsFile', () => {
  it('메모리의 가짜 XLS를 읽어 계좌 거래 Preview를 만든다', async () => {
    const data = createWorkbookData([
      [],
      [],
      [],
      ['거래일시', '적요', '참고1', '참고2', '찾으신금액', '맡기신금액'],
      ['2026.08.01', '가짜 시장', '', '', 10_000, 0],
    ]);

    const preview = await previewLegacyXlsFile({
      name: 'fake-account.xls',
      size: data.byteLength,
      arrayBuffer: async () => data,
    });

    expect(preview.candidates).toHaveLength(1);
    expect(preview.candidates[0]?.draft.descriptionOriginal).toBe('가짜 시장');
  });

  it('확장자와 크기 제한을 파일명이나 원본 값 없이 거부한다', async () => {
    const extensionPreview = await previewLegacyXlsFile({
      name: 'private.xlsx',
      size: 100,
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const sizePreview = await previewLegacyXlsFile({
      name: 'fake.xls',
      size: MAX_LEGACY_XLS_FILE_BYTES + 1,
      arrayBuffer: async () => new ArrayBuffer(0),
    });

    expect(extensionPreview.issues).toEqual([
      {
        code: 'unsupported_file',
        message: '현재는 XLS 파일만 가져올 수 있습니다.',
      },
    ]);
    expect(sizePreview.issues).toEqual([
      {
        code: 'unsupported_file',
        message: '파일 크기가 지원 범위를 벗어났습니다.',
      },
    ]);
    expect(JSON.stringify(extensionPreview)).not.toContain('private.xlsx');
  });

  it('행·열 제한을 Preview 전에 차단한다', () => {
    const tooManyColumns = createWorkbookData([
      Array.from({ length: 21 }, (_, index) => `열${index + 1}`),
    ]);

    expect(previewLegacyXlsArrayBuffer(tooManyColumns).issues).toEqual([
      {
        code: 'unsupported_file',
        message: '파일의 행 또는 열 수가 지원 범위를 벗어났습니다.',
      },
    ]);
  });
});
