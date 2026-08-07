import {
  DEFAULT_MERCHANT_ALIAS_REGISTRY,
  resolveMerchantAlias,
  type MerchantAliasRegistry,
} from './merchant-alias-registry';
import { matchMerchantFuzzy } from './merchant-matcher';
import { normalizeMerchantName } from './merchant-normalizer';
import { isPaymentIntermediaryMerchant } from './payment-intermediary';

export type MerchantResolutionSource = 'EXACT' | 'ALIAS' | 'FUZZY' | 'REVIEW';
export type MerchantResolutionConfidence =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'REVIEW';
export type MerchantResolutionReviewReason =
  | 'PAYMENT_INTERMEDIARY'
  | 'NO_KNOWN_MERCHANT'
  | 'AMBIGUOUS_FUZZY_MATCH';

export type MerchantNameResolution = Readonly<{
  original: string;
  normalized: string;
  comparisonKey: string;
  canonicalQuery: string;
  source: MerchantResolutionSource;
  confidence: MerchantResolutionConfidence;
  canSearchKakao: boolean;
  canonicalBrand?: string;
  matchedAlias?: string;
  reviewReason?: MerchantResolutionReviewReason;
}>;

export function resolveMerchantName(
  merchantName: string,
  registry: MerchantAliasRegistry = DEFAULT_MERCHANT_ALIAS_REGISTRY,
): MerchantNameResolution {
  const normalization = normalizeMerchantName(merchantName);

  if (isPaymentIntermediaryMerchant(merchantName)) {
    return {
      ...normalization,
      canonicalQuery: normalization.normalized,
      source: 'REVIEW',
      confidence: 'REVIEW',
      canSearchKakao: false,
      reviewReason: 'PAYMENT_INTERMEDIARY',
    };
  }

  const aliasMatch = resolveMerchantAlias(normalization, registry);

  if (aliasMatch !== null) {
    const isCanonical =
      normalizeMerchantName(aliasMatch.canonicalBrand).comparisonKey ===
      normalizeMerchantName(aliasMatch.matchedAlias).comparisonKey;

    return {
      ...normalization,
      canonicalQuery: aliasMatch.canonicalQuery,
      source: isCanonical ? 'EXACT' : 'ALIAS',
      confidence: 'HIGH',
      canSearchKakao: true,
      canonicalBrand: aliasMatch.canonicalBrand,
      matchedAlias: aliasMatch.matchedAlias,
    };
  }

  const fuzzyMatch = matchMerchantFuzzy(normalization, registry);

  if (fuzzyMatch.status === 'MATCHED') {
    return {
      ...normalization,
      canonicalQuery: fuzzyMatch.match.canonicalQuery,
      source: 'FUZZY',
      confidence: 'MEDIUM',
      canSearchKakao: true,
      canonicalBrand: fuzzyMatch.match.canonicalBrand,
      matchedAlias: fuzzyMatch.match.matchedAlias,
    };
  }

  return {
    ...normalization,
    canonicalQuery: normalization.normalized,
    source: 'REVIEW',
    confidence: normalization.normalized.length === 0 ? 'REVIEW' : 'LOW',
    canSearchKakao: normalization.normalized.length > 0,
    reviewReason:
      fuzzyMatch.status === 'AMBIGUOUS'
        ? 'AMBIGUOUS_FUZZY_MATCH'
        : 'NO_KNOWN_MERCHANT',
  };
}
