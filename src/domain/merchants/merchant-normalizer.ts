export type MerchantNameNormalization = Readonly<{
  original: string;
  normalized: string;
  comparisonKey: string;
}>;

export type MerchantNamePrefix = Readonly<{
  comparisonKey: string;
  branch: string;
  hasExplicitBoundary: boolean;
}>;

const MERCHANT_COMPARISON_CHARACTER_PATTERN = /[\p{L}\p{N}]/u;

export function normalizeMerchantName(value: string): MerchantNameNormalization {
  const normalized = value
    .normalize('NFKC')
    .replaceAll(/[\p{P}\p{S}]+/gu, ' ')
    .replaceAll(/\s+/gu, ' ')
    .trim();

  return {
    original: value,
    normalized,
    comparisonKey: Array.from(normalized)
      .filter((character) =>
        MERCHANT_COMPARISON_CHARACTER_PATTERN.test(character),
      )
      .join('')
      .toLowerCase(),
  };
}

export function splitMerchantNamePrefix(
  normalization: MerchantNameNormalization,
  comparisonCharacterCount: number,
): MerchantNamePrefix | null {
  if (comparisonCharacterCount <= 0) {
    return null;
  }

  let comparisonKey = '';
  let comparisonCharacters = 0;
  let endOffset = 0;

  for (const character of normalization.normalized) {
    endOffset += character.length;

    if (!MERCHANT_COMPARISON_CHARACTER_PATTERN.test(character)) {
      continue;
    }

    comparisonKey += character.toLowerCase();
    comparisonCharacters += 1;

    if (comparisonCharacters === comparisonCharacterCount) {
      const remainder = normalization.normalized.slice(endOffset);

      return {
        comparisonKey,
        branch: remainder.trim(),
        hasExplicitBoundary: /^\s/u.test(remainder),
      };
    }
  }

  return null;
}
