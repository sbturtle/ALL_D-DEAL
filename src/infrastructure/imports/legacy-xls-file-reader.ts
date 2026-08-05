import * as XLSX from 'xlsx';

import {
  MAX_IMPORT_CELL_TEXT_LENGTH,
  MAX_IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  previewLegacyXlsRows,
} from '../../domain/imports/legacy-xls-preview';
import type {
  ImportPreview,
  LegacyXlsRows,
} from '../../domain/imports/legacy-xls-preview';

export const MAX_LEGACY_XLS_FILE_BYTES = 5 * 1024 * 1024;

export type BrowserImportFile = Pick<File, 'arrayBuffer' | 'name' | 'size'>;

function createUnsupportedFilePreview(message: string): ImportPreview {
  return {
    candidates: [],
    issues: [
      {
        code: 'unsupported_file',
        message,
      },
    ],
  };
}

function createInvalidTextPreview(): ImportPreview {
  return {
    candidates: [],
    issues: [
      {
        code: 'invalid_text',
        message: '파일 안의 텍스트 길이가 지원 범위를 벗어났습니다.',
      },
    ],
  };
}

function hasLegacyXlsExtension(fileName: string): boolean {
  return /\.xls$/i.test(fileName);
}

function isWithinCellTextLimit(rows: LegacyXlsRows): boolean {
  return rows.every((row) =>
    row.every(
      (value) =>
        typeof value !== 'string' || value.length <= MAX_IMPORT_CELL_TEXT_LENGTH,
    ),
  );
}

function readFirstWorksheetRows(data: ArrayBuffer): ImportPreview | LegacyXlsRows {
  try {
    const workbook = XLSX.read(data, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
      cellText: true,
      raw: true,
    });
    const firstSheetName = workbook.SheetNames[0];

    if (firstSheetName === undefined) {
      return createUnsupportedFilePreview('읽을 수 있는 시트가 없습니다.');
    }

    const worksheet = workbook.Sheets[firstSheetName];

    if (worksheet === undefined || worksheet['!ref'] === undefined) {
      return createUnsupportedFilePreview('읽을 수 있는 거래 표가 없습니다.');
    }

    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const rowCount = range.e.r - range.s.r + 1;
    const columnCount = range.e.c - range.s.c + 1;

    if (rowCount > MAX_IMPORT_ROWS || columnCount > MAX_IMPORT_COLUMNS) {
      return createUnsupportedFilePreview('파일의 행 또는 열 수가 지원 범위를 벗어났습니다.');
    }

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
    });

    return rows;
  } catch {
    return createUnsupportedFilePreview('지원하지 않는 XLS 파일입니다.');
  }
}

function isPreview(value: ImportPreview | LegacyXlsRows): value is ImportPreview {
  return !Array.isArray(value) || (value.length > 0 && !Array.isArray(value[0]));
}

export function previewLegacyXlsArrayBuffer(data: ArrayBuffer): ImportPreview {
  const rows = readFirstWorksheetRows(data);

  if (isPreview(rows)) {
    return rows;
  }

  if (!isWithinCellTextLimit(rows)) {
    return createInvalidTextPreview();
  }

  return previewLegacyXlsRows(rows);
}

export async function previewLegacyXlsFile(
  file: BrowserImportFile,
): Promise<ImportPreview> {
  if (!hasLegacyXlsExtension(file.name)) {
    return createUnsupportedFilePreview('현재는 XLS 파일만 가져올 수 있습니다.');
  }

  if (file.size <= 0 || file.size > MAX_LEGACY_XLS_FILE_BYTES) {
    return createUnsupportedFilePreview('파일 크기가 지원 범위를 벗어났습니다.');
  }

  try {
    return previewLegacyXlsArrayBuffer(await file.arrayBuffer());
  } catch {
    return createUnsupportedFilePreview('파일을 읽는 중 문제가 발생했습니다.');
  }
}
