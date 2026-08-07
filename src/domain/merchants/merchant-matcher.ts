import {
  createCanonicalMerchantQuery,
  DEFAULT_MERCHANT_ALIAS_REGISTRY,
  isSafeMerchantBranch,
  type MerchantAliasRegistry,
} from './merchant-alias-registry';
import {
  normalizeMerchantName,
  splitMerchantNamePrefix,
  type MerchantNameNormalization,
  type MerchantNamePrefix,
} from './merchant-normalizer';

export const MIN_FUZZY_MERCHANT_SIMILARITY = 0.82;
const MIN_FUZZY_ALIAS_LENGTH = 6;
const MAX_FUZZY_EDIT_DISTANCE = 1;
const MIN_FUZZY_WINNER_MARGIN = 0.05;

export type MerchantFuzzyMatch = Readonly<{
  canonicalBrand: string;
  canonicalQuery: string;
  matchedAlias: string;
  similarity: number;
  prefix: MerchantNamePrefix;
}>;

export type MerchantFuzzyMatchResult =
  | Readonly<{ status: 'MATCHED'; match: MerchantFuzzyMatch }>
  | Readonly<{ status: 'NO_MATCH' }>
  | Readonly<{ status: 'AMBIGUOUS' }>;

type ScoredMerchantAlias = MerchantFuzzyMatch &
  Readonly<{ editDistance: number; prefixLengthDelta: number }>;

function calculateEditDistance(left: string, right: string): number {
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);
  let previous = rightCharacters.map((_, index) => index + 1);
  previous.unshift(0);

  for (let leftIndex = 1; leftIndex <= leftCharacters.length; leftIndex += 1) {
    const current = [leftIndex];
    const leftCharacter = leftCharacters[leftIndex - 1];

    for (
      let rightIndex = 1;
      rightIndex <= rightCharacters.length;
      rightIndex += 1
    ) {
      const substitutionCost =
        leftCharacter === rightCharacters[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + substitutionCost,
      );
    }

    previous = current;
  }

  return previous[rightCharacters.length] ?? 0;
}

function getBestAliasScore(
  normalization: MerchantNameNormalization,
  canonicalBrand: string,
  alias: string,
): ScoredMerchantAlias | null {
  const aliasKey = normalizeMerchantName(alias).comparisonKey;
  const aliasLength = Array.from(aliasKey).length;

  if (aliasLength < MIN_FUZZY_ALIAS_LENGTH) {
    return null;
  }

  const inputLength = Array.from(normalization.comparisonKey).length;
  let bestScore: ScoredMerchantAlias | null = null;

  for (
    let prefixLength = Math.max(1, aliasLength - 1);
    prefixLength <= Math.min(inputLength, aliasLength + 1);
    prefixLength += 1
  ) {
    const prefix = splitMerchantNamePrefix(normalization, prefixLength);

    if (prefix === null || !isSafeMerchantBranch(prefix)) {
      continue;
    }

    const editDistance = calculateEditDistance(
      aliasKey,
      prefix.comparisonKey,
    );
    const similarity =
      1 - editDistance / Math.max(aliasLength, prefixLength);

    if (
      editDistance > MAX_FUZZY_EDIT_DISTANCE ||
      similarity < MIN_FUZZY_MERCHANT_SIMILARITY
    ) {
      continue;
    }

    if (
      bestScore === null ||
      similarity > bestScore.similarity ||
      (similarity === bestScore.similarity &&
        (editDistance < bestScore.editDistance ||
          (editDistance === bestScore.editDistance &&
            Math.abs(prefixLength - aliasLength) <
              bestScore.prefixLengthDelta)))
    ) {
      bestScore = {
        canonicalBrand,
        canonicalQuery: createCanonicalMerchantQuery(
          canonicalBrand,
          prefix.branch,
        ),
        matchedAlias: alias,
        similarity,
        prefix,
        editDistance,
        prefixLengthDelta: Math.abs(prefixLength - aliasLength),
      };
    }
  }

  return bestScore;
}

export function matchMerchantFuzzy(
  normalization: MerchantNameNormalization,
  registry: MerchantAliasRegistry = DEFAULT_MERCHANT_ALIAS_REGISTRY,
): MerchantFuzzyMatchResult {
  const bestByCanonical = new Map<string, ScoredMerchantAlias>();

  registry.forEach((group) => {
    group.aliases.forEach((alias) => {
      const score = getBestAliasScore(normalization, group.canonical, alias);
      const previous = bestByCanonical.get(group.canonical);

      if (
        score !== null &&
        (previous === undefined ||
          score.similarity > previous.similarity ||
          (score.similarity === previous.similarity &&
            (score.editDistance < previous.editDistance ||
              (score.editDistance === previous.editDistance &&
                score.prefixLengthDelta < previous.prefixLengthDelta))))
      ) {
        bestByCanonical.set(group.canonical, score);
      }
    });
  });

  const ranked = Array.from(bestByCanonical.values()).sort(
    (left, right) =>
      right.similarity - left.similarity ||
      left.editDistance - right.editDistance,
  );
  const best = ranked[0];
  const runnerUp = ranked[1];

  if (best === undefined) {
    return { status: 'NO_MATCH' };
  }

  if (
    runnerUp !== undefined &&
    best.similarity - runnerUp.similarity < MIN_FUZZY_WINNER_MARGIN
  ) {
    return { status: 'AMBIGUOUS' };
  }

  const {
    editDistance: ignoredEditDistance,
    prefixLengthDelta: ignoredPrefixLengthDelta,
    ...match
  } = best;
  void ignoredEditDistance;
  void ignoredPrefixLengthDelta;

  return { status: 'MATCHED', match };
}
