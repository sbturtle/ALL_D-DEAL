import type { PlaceSearchResult } from '../../application/places/place-search';
import type { CategoryId } from './category';
import { normalizeCategoryRuleDescription } from './category-rule';
import { mapKakaoCategoryName } from './kakao-category-mapper';

export type KakaoPlaceCategoryClassification =
  | Readonly<{
      status: 'CLASSIFIED';
      source: 'KAKAO_LOCAL';
      confidence: 'HIGH';
      categoryId: CategoryId;
      place: PlaceSearchResult;
    }>
  | Readonly<{
      status: 'NEEDS_REVIEW';
      source: 'KAKAO_LOCAL' | 'NOT_QUERIED';
      confidence: 'REVIEW';
      reason:
        | 'PAYMENT_INTERMEDIARY'
        | 'NO_EXACT_MERCHANT_MATCH'
        | 'UNMAPPED_KAKAO_CATEGORY';
    }>;

const PAYMENT_INTERMEDIARY_PATTERN =
  /PAYCO\s*오더|네이버\s*페이|카카오\s*페이|토스\s*페이|KG\s*이니시스/i;

export function isPaymentIntermediaryMerchant(merchantName: string): boolean {
  return PAYMENT_INTERMEDIARY_PATTERN.test(merchantName);
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

  const normalizedMerchantName = normalizeCategoryRuleDescription(merchantName);
  const matchedPlace = places.find(
    (place) =>
      normalizeCategoryRuleDescription(place.placeName) === normalizedMerchantName,
  );

  if (matchedPlace === undefined) {
    return {
      status: 'NEEDS_REVIEW',
      source: 'KAKAO_LOCAL',
      confidence: 'REVIEW',
      reason: 'NO_EXACT_MERCHANT_MATCH',
    };
  }

  const categoryId = mapKakaoCategoryName(matchedPlace.categoryName);

  if (categoryId === undefined) {
    return {
      status: 'NEEDS_REVIEW',
      source: 'KAKAO_LOCAL',
      confidence: 'REVIEW',
      reason: 'UNMAPPED_KAKAO_CATEGORY',
    };
  }

  return {
    status: 'CLASSIFIED',
    source: 'KAKAO_LOCAL',
    confidence: 'HIGH',
    categoryId,
    place: matchedPlace,
  };
}
