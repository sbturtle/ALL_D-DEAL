import type { ImportSource } from './legacy-xls-preview';
import type { UtcIsoInstant } from '../transactions/utc-iso-instant';

export const LEGACY_XLS_IMPORTER_ID = 'LEGACY_XLS' as const;
export const LEGACY_XLS_IMPORTER_VERSION = 1 as const;

export type ImportBatch = Readonly<{
  id: string;
  importerId: typeof LEGACY_XLS_IMPORTER_ID;
  importerVersion: typeof LEGACY_XLS_IMPORTER_VERSION;
  sourceType: ImportSource;
  committedAt: UtcIsoInstant;
  newCount: number;
  skippedCount: number;
  reviewedCount: number;
}>;
