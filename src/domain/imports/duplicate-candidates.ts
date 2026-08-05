import type {
  ImportCandidate,
  TransactionDraft,
} from './legacy-xls-preview';
import type { Transaction } from '../transactions/transaction';

type DuplicateComparable = Pick<
  TransactionDraft,
  | 'occurredOn'
  | 'amountMinor'
  | 'currency'
  | 'direction'
  | 'type'
  | 'descriptionOriginal'
>;

export type DuplicateCandidateMatch = Readonly<{
  candidateIndex: number;
  savedTransactionIds: readonly string[];
  previewCandidateIndexes: readonly number[];
}>;

const FNV1A_64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV1A_64_PRIME = 0x100000001b3n;

export function normalizeDescriptionForDuplicateComparison(
  description: string,
): string {
  return description
    .normalize('NFKC')
    .toLowerCase()
    .replaceAll(/[\p{P}\p{S}]/gu, '')
    .replaceAll(/\s+/gu, ' ')
    .trim();
}

function fingerprintInput(value: DuplicateComparable): string {
  return JSON.stringify([
    value.occurredOn,
    value.amountMinor,
    value.currency,
    value.direction,
    value.type,
    normalizeDescriptionForDuplicateComparison(value.descriptionOriginal),
  ]);
}

function fnv1a64(value: string): string {
  let hash = FNV1A_64_OFFSET_BASIS;

  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * FNV1A_64_PRIME);
  }

  return hash.toString(16).padStart(16, '0');
}

/**
 * A transient, non-cryptographic candidate-comparison key. It is not proof that
 * two transactions are the same and must not be persisted or used for deletion.
 */
export function createDuplicateFingerprintV1(value: DuplicateComparable): string {
  return `v1:${fnv1a64(fingerprintInput(value))}`;
}

export function findPotentialDuplicateCandidates(
  candidates: readonly ImportCandidate[],
  savedTransactions: readonly Transaction[],
): readonly DuplicateCandidateMatch[] {
  const savedIdsByFingerprint = new Map<string, string[]>();

  for (const transaction of savedTransactions) {
    const fingerprint = createDuplicateFingerprintV1(transaction);
    const ids = savedIdsByFingerprint.get(fingerprint) ?? [];
    ids.push(transaction.id);
    savedIdsByFingerprint.set(fingerprint, ids);
  }

  const candidateIndexesByFingerprint = new Map<string, number[]>();
  const matches: DuplicateCandidateMatch[] = [];

  candidates.forEach((candidate, candidateIndex) => {
    const fingerprint = createDuplicateFingerprintV1(candidate.draft);
    const savedTransactionIds = savedIdsByFingerprint.get(fingerprint) ?? [];
    const previewCandidateIndexes =
      candidateIndexesByFingerprint.get(fingerprint) ?? [];

    if (savedTransactionIds.length > 0 || previewCandidateIndexes.length > 0) {
      matches.push({
        candidateIndex,
        savedTransactionIds,
        previewCandidateIndexes,
      });
    }

    candidateIndexesByFingerprint.set(fingerprint, [
      ...previewCandidateIndexes,
      candidateIndex,
    ]);
  });

  return matches;
}
