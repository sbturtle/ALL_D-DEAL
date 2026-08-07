import type { PlaceSearchResult } from '../../application/places/place-search';
import {
  resolveMerchantName,
  type MerchantNameResolution,
} from '../merchants/merchant-name-resolver';
import { normalizeMerchantName } from '../merchants/merchant-normalizer';
import { isPaymentIntermediaryMerchant } from '../merchants/payment-intermediary';
import type { CategoryId } from './category';
import { mapKakaoCategoryName } from './kakao-category-mapper';

export { isPaymentIntermediaryMerchant } from '../merchants/payment-intermediary';

export type KakaoPlaceCategoryReviewReason =
  | 'PAYMENT_INTERMEDIARY'
  | 'NO_EXACT_MERCHANT_MATCH'
  | 'UNMAPPED_KAKAO_CATEGORY';

export type KakaoPlaceCategoryClassification =
  | Readonly<{
      status: 'CLASSIFIED';
      source: 'KAKAO_LOCAL';
      confidence: 'HIGH' | 'MEDIUM';
      categoryId: CategoryId;
      place: PlaceSearchResult;
    }>
  | Readonly<{
      status: 'NEEDS_REVIEW';
      source: 'KAKAO_LOCAL' | 'NOT_QUERIED';
      confidence: 'REVIEW';
      reason: KakaoPlaceCategoryReviewReason;
      place?: PlaceSearchResult;
    }>;

type MerchantPlaceMatch = Readonly<{
  place: PlaceSearchResult;
  confidence: 'HIGH' | 'MEDIUM';
}>;

function isResolvedCanonicalMerchant(
  resolution: MerchantNameResolution,
): boolean {
  return resolution.source !== 'REVIEW';
}

function matchMerchantPlace(
  merchantName: string,
  merchantResolution: MerchantNameResolution,
  place: PlaceSearchResult,
): MerchantPlaceMatch | null {
  const merchantComparisonKey = normalizeMerchantName(merchantName).comparisonKey;
  const placeComparisonKey = normalizeMerchantName(place.placeName).comparisonKey;

  if (
    merchantComparisonKey.length > 0 &&
    merchantComparisonKey === placeComparisonKey
  ) {
    return { place, confidence: 'HIGH' };
  }

  const placeResolution = resolveMerchantName(place.placeName);

  if (
    !isResolvedCanonicalMerchant(merchantResolution) ||
    placeResolution.source === 'REVIEW' ||
    placeResolution.source === 'FUZZY'
  ) {
    return null;
  }

  const merchantCanonicalKey = normalizeMerchantName(
    merchantResolution.canonicalQuery,
  ).comparisonKey;
  const placeCanonicalKey = normalizeMerchantName(
    placeResolution.canonicalQuery,
  ).comparisonKey;

  return merchantCanonicalKey.length > 0 &&
    merchantCanonicalKey === placeCanonicalKey
    ? {
        place,
        confidence:
          merchantResolution.source === 'FUZZY' ? 'MEDIUM' : 'HIGH',
      }
    : null;
}

export function classifyKakaoPlaceCategory(
  merchantName: string,
  places: readonly PlaceSearchResult[],
): KakaoPlaceCategoryClassification {
  if (isPaymentIntermediaryMerchant(merchantName)) {
    return {
      status: 'NEEDS_REVIEW',
      source: 'NOT_QUERIED',
      confidence: 'REVIEW',
      reason: 'PAYMENT_INTERMEDIARY',
    };
  }

  const merchantResolution = resolveMerchantName(merchantName);
  const matches = places.flatMap((place) => {
    const match = matchMerchantPlace(merchantName, merchantResolution, place);
    return match === null ? [] : [match];
  });
  const classifiedMatch = matches.find(
    ({ place }) => mapKakaoCategoryName(place.categoryName) !== undefined,
  );

  if (classifiedMatch !== undefined) {
    const categoryId = mapKakaoCategoryName(
      classifiedMatch.place.categoryName,
    );

    if (categoryId !== undefined) {
      return {
        status: 'CLASSIFIED',
        source: 'KAKAO_LOCAL',
        confidence: classifiedMatch.confidence,
        categoryId,
        place: classifiedMatch.place,
      };
    }
  }

  const unmappedMatch = matches[0];

  if (unmappedMatch !== undefined) {
    return {
      status: 'NEEDS_REVIEW',
      source: 'KAKAO_LOCAL',
      confidence: 'REVIEW',
      reason: 'UNMAPPED_KAKAO_CATEGORY',
      place: unmappedMatch.place,
    };
  }

  return {
    status: 'NEEDS_REVIEW',
    source: 'KAKAO_LOCAL',
    confidence: 'REVIEW',
    reason: 'NO_EXACT_MERCHANT_MATCH',
  };
}
