import { describe, expect, it } from 'vitest';

import type {
  ImportCandidate,
  TransactionDraft,
} from './legacy-xls-preview';
import type { Transaction } from '../transactions/transaction';
import {
  createDuplicateFingerprintV1,
  findPotentialDuplicateCandidates,
  normalizeDescriptionForDuplicateComparison,
} from './duplicate-candidates';

const draft: TransactionDraft = {
  occurredOn: '2026-08-05',
  amountMinor: 42_000,
  currency: 'KRW',
  direction: 'OUTFLOW',
  type: 'EXPENSE',
  budgetBucketId: 'LIVING',
  descriptionOriginal: 'Fabricated Cafe - Seoul!',
};

function candidate(
  rowNumber: number,
  overrides: Partial<TransactionDraft> = {},
): ImportCandidate {
  return {
    source: 'CARD_USAGE_XLS',
    rowNumber,
    draft: { ...draft, ...overrides },
  };
}

function transaction(
  id: string,
  overrides: Partial<TransactionDraft> = {},
): Transaction {
  return {
    id,
    ...draft,
    ...overrides,
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-05T00:00:00.000Z',
  };
}

describe('duplicate candidate comparison', () => {
  it('normalizes compatibility characters, spacing, case, and punctuation', () => {
    expect(normalizeDescriptionForDuplicateComparison(' Ｆabricated  Cafe—SEOUL! ')).toBe(
      'fabricated cafeseoul',
    );
    expect(createDuplicateFingerprintV1(draft)).toBe(
      createDuplicateFingerprintV1({
        ...draft,
        descriptionOriginal: 'fabricated cafe seoul',
      }),
    );
  });

  it('changes the v1 fingerprint when a core comparison field differs', () => {
    expect(createDuplicateFingerprintV1(draft)).not.toBe(
      createDuplicateFingerprintV1({ ...draft, amountMinor: 42_001 }),
    );
  });

  it('returns saved and earlier-preview matches without treating them as decisions', () => {
    const matches = findPotentialDuplicateCandidates(
      [
        candidate(5),
        candidate(6, { descriptionOriginal: 'fabricated cafe seoul' }),
        candidate(7, { amountMinor: 1_000 }),
      ],
      [transaction('550e8400-e29b-41d4-a716-446655440000')],
    );

    expect(matches).toEqual([
      {
        candidateIndex: 0,
        savedTransactionIds: ['550e8400-e29b-41d4-a716-446655440000'],
        previewCandidateIndexes: [],
      },
      {
        candidateIndex: 1,
        savedTransactionIds: ['550e8400-e29b-41d4-a716-446655440000'],
        previewCandidateIndexes: [0],
      },
    ]);
  });
});
