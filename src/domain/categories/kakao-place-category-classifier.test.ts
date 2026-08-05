import { describe, expect, it } from 'vitest';

import type { PlaceSearchResult } from '../../application/places/place-search';
import {
  classifyKakaoPlaceCategory,
  isPaymentIntermediaryMerchant,
} from './kakao-place-category-classifier';

const fabricatedCafe: PlaceSearchResult = {
  id: 'place-1',
  placeName: 'Fabricated Cafe',
  categoryName: '음식점 > 카페 > 커피전문점',
  categoryGroupCode: '',
  categoryGroupName: '',
  addressName: 'Fabricated parcel address',
  roadAddressName: 'Fabricated road address',
  x: '127.0000',
  y: '37.0000',
};

describe('classifyKakaoPlaceCategory', () => {
  it('maps category_name even when category group fields are empty', () => {
    expect(
      classifyKakaoPlaceCategory('Fabricated Cafe', [fabricatedCafe]),
    ).toEqual({
      status: 'CLASSIFIED',
      source: 'KAKAO_LOCAL',
      confidence: 'HIGH',
      categoryId: 'CAFE',
      place: fabricatedCafe,
    });
  });

  it('keeps an unmatched merchant and an unmapped Kakao category in review', () => {
    expect(
      classifyKakaoPlaceCategory('Different Merchant', [fabricatedCafe]),
    ).toMatchObject({
      status: 'NEEDS_REVIEW',
      reason: 'NO_EXACT_MERCHANT_MATCH',
    });
    expect(
      classifyKakaoPlaceCategory('Fabricated Cafe', [
        { ...fabricatedCafe, categoryName: '숙박 > 호텔' },
      ]),
    ).toMatchObject({
      status: 'NEEDS_REVIEW',
      reason: 'UNMAPPED_KAKAO_CATEGORY',
    });
  });

  it('excludes payment intermediaries before a Kakao lookup', () => {
    expect(isPaymentIntermediaryMerchant('네이버페이 주문')).toBe(true);
    expect(
      classifyKakaoPlaceCategory('KG이니시스', [fabricatedCafe]),
    ).toMatchObject({
      status: 'NEEDS_REVIEW',
      source: 'NOT_QUERIED',
      reason: 'PAYMENT_INTERMEDIARY',
    });
  });
});
