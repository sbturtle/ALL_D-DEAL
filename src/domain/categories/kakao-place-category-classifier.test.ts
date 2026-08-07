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

  it('matches canonical-equivalent aliases only when the branch also matches', () => {
    const fabricatedConvenienceStore = {
      ...fabricatedCafe,
      id: 'place-convenience',
      placeName: 'GS25 대전법동점',
      categoryName: '가정,생활 > 편의점 > GS25',
    };

    expect(
      classifyKakaoPlaceCategory('지에쓰이십오 대전법동점', [
        fabricatedConvenienceStore,
      ]),
    ).toMatchObject({
      status: 'CLASSIFIED',
      categoryId: 'CONVENIENCE',
      confidence: 'HIGH',
      place: fabricatedConvenienceStore,
    });
    expect(
      classifyKakaoPlaceCategory('지에쓰이십오 한남대점', [
        fabricatedConvenienceStore,
      ]),
    ).toMatchObject({
      status: 'NEEDS_REVIEW',
      reason: 'NO_EXACT_MERCHANT_MATCH',
    });
  });

  it('marks a fuzzy canonical match as medium confidence', () => {
    expect(
      classifyKakaoPlaceCategory('메가엠지시커피 대전법동점', [
        { ...fabricatedCafe, placeName: '메가MGC커피 대전법동점' },
      ]),
    ).toMatchObject({
      status: 'CLASSIFIED',
      categoryId: 'CAFE',
      confidence: 'MEDIUM',
    });
  });

  it('prefers a mapped canonical-equivalent place over an unmapped one', () => {
    const unmappedPlace = {
      ...fabricatedCafe,
      id: 'unmapped',
      placeName: '씨유 한남대점',
      categoryName: '숙박 > 호텔',
    };
    const mappedPlace = {
      ...fabricatedCafe,
      id: 'mapped',
      placeName: 'CU 한남대점',
      categoryName: '가정,생활 > 편의점 > CU',
    };

    expect(
      classifyKakaoPlaceCategory('씨유 한남대점', [
        unmappedPlace,
        mappedPlace,
      ]),
    ).toMatchObject({
      status: 'CLASSIFIED',
      categoryId: 'CONVENIENCE',
      place: mappedPlace,
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
