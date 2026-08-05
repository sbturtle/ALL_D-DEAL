import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';

export type LegacyXlsImportFile = Readonly<{
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}>;

export type LegacyXlsPreviewReader = (
  file: LegacyXlsImportFile,
) => Promise<ImportPreview>;

export function prepareLegacyXlsImportPreview(
  file: LegacyXlsImportFile,
  reader: LegacyXlsPreviewReader,
): Promise<ImportPreview> {
  return reader(file);
}
