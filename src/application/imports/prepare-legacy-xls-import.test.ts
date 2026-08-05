import { describe, expect, it, vi } from 'vitest';

import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import {
  prepareLegacyXlsImportPreview,
  type LegacyXlsImportFile,
} from './prepare-legacy-xls-import';

const preview: ImportPreview = {
  source: 'ACCOUNT_LEDGER_XLS',
  candidates: [],
  issues: [],
};

describe('prepareLegacyXlsImportPreview', () => {
  it('선택한 파일을 Preview reader에 그대로 전달한다', async () => {
    const file: LegacyXlsImportFile = {
      name: 'fake.xls',
      size: 10,
      arrayBuffer: async () => new ArrayBuffer(10),
    };
    const reader = vi.fn().mockResolvedValue(preview);

    await expect(prepareLegacyXlsImportPreview(file, reader)).resolves.toBe(preview);
    expect(reader).toHaveBeenCalledWith(file);
  });
});
