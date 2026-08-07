import {
  normalizeMerchantName,
  splitMerchantNamePrefix,
  type MerchantNameNormalization,
  type MerchantNamePrefix,
} from './merchant-normalizer';

export type MerchantAliasGroup = Readonly<{
  canonical: string;
  aliases: readonly string[];
}>;

export type MerchantAliasRegistry = readonly MerchantAliasGroup[];

export type MerchantAliasMatch = Readonly<{
  canonicalBrand: string;
  canonicalQuery: string;
  matchedAlias: string;
  prefix: MerchantNamePrefix;
}>;

// 카드사 Merchant Name에는 영문 브랜드가 한글 발음으로 변환되어
// 내려오는 경우가 있어 Kakao 검색 전에 한곳의 canonical alias를 적용한다.
export const DEFAULT_MERCHANT_ALIAS_REGISTRY: MerchantAliasRegistry = [
  {
    canonical: 'GS25',
    aliases: ['GS25', '지에스25', '지에쓰25', '지에쓰이십오'],
  },
  { canonical: 'CU', aliases: ['CU', '씨유'] },
  {
    canonical: '7-ELEVEN',
    aliases: ['7-ELEVEN', '세븐일레븐', '7일레븐'],
  },
  {
    canonical: '메가MGC커피',
    aliases: ['메가MGC커피', '메가엠지씨커피', '메가커피'],
  },
];

function isAsciiLetterOrNumber(value: string): boolean {
  return /^[a-z0-9]$/i.test(value);
}

export function isSafeMerchantBranch(prefix: MerchantNamePrefix): boolean {
  if (prefix.branch.length === 0 || prefix.hasExplicitBoundary) {
    return true;
  }

  const prefixCharacters = Array.from(prefix.comparisonKey);
  const branchCharacters = Array.from(prefix.branch);
  const lastPrefixCharacter = prefixCharacters.at(-1);
  const firstBranchCharacter = branchCharacters[0];

  if (
    lastPrefixCharacter !== undefined &&
    firstBranchCharacter !== undefined &&
    isAsciiLetterOrNumber(lastPrefixCharacter) &&
    isAsciiLetterOrNumber(firstBranchCharacter)
  ) {
    return false;
  }

  return branchCharacters.length >= 2 && /(?:점|지점|점포)$/u.test(prefix.branch);
}

export function createCanonicalMerchantQuery(
  canonicalBrand: string,
  branch: string,
): string {
  return branch.length === 0 ? canonicalBrand : `${canonicalBrand} ${branch}`;
}

export function resolveMerchantAlias(
  normalization: MerchantNameNormalization,
  registry: MerchantAliasRegistry = DEFAULT_MERCHANT_ALIAS_REGISTRY,
): MerchantAliasMatch | null {
  const candidates = registry
    .flatMap((group) =>
      group.aliases.map((alias) => ({
        canonicalBrand: group.canonical,
        alias,
        aliasKey: normalizeMerchantName(alias).comparisonKey,
      })),
    )
    .sort(
      (left, right) =>
        Array.from(right.aliasKey).length - Array.from(left.aliasKey).length,
    );

  for (const candidate of candidates) {
    const prefix = splitMerchantNamePrefix(
      normalization,
      Array.from(candidate.aliasKey).length,
    );

    if (
      prefix?.comparisonKey !== candidate.aliasKey ||
      !isSafeMerchantBranch(prefix)
    ) {
      continue;
    }

    return {
      canonicalBrand: candidate.canonicalBrand,
      canonicalQuery: createCanonicalMerchantQuery(
        candidate.canonicalBrand,
        prefix.branch,
      ),
      matchedAlias: candidate.alias,
      prefix,
    };
  }

  return null;
}
