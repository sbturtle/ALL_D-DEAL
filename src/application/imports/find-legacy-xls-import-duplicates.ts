import {
  findPotentialDuplicateCandidates,
  type DuplicateCandidateMatch,
} from '../../domain/imports/duplicate-candidates';
import type { ImportPreview } from '../../domain/imports/legacy-xls-preview';
import type { Transaction } from '../../domain/transactions/transaction';

export type LegacyXlsDuplicateTransactionReader = Readonly<{
  listAllTransactions: () => Promise<readonly Transaction[]>;
}>;

export async function findPotentialLegacyXlsImportDuplicates(
  preview: ImportPreview,
  reader: LegacyXlsDuplicateTransactionReader,
): Promise<readonly DuplicateCandidateMatch[]> {
  if (preview.candidates.length === 0) {
    return [];
  }

  const savedTransactions = await reader.listAllTransactions();

  return findPotentialDuplicateCandidates(preview.candidates, savedTransactions);
}
