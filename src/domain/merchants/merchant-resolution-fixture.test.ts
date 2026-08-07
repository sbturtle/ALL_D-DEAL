import { describe, expect, it } from 'vitest';

import type { PlaceSearchResult } from '../../application/places/place-search';
import { normalizeCategoryRuleDescription } from '../categories/category-rule';
import { classifyKakaoPlaceCategory } from '../categories/kakao-place-category-classifier';
import { mapKakaoCategoryName } from '../categories/kakao-category-mapper';
import { resolveMerchantName } from './merchant-name-resolver';

type FixtureResolutionSource =
  | 'EXACT'
  | 'ALIAS'
  | 'FUZZY'
  | 'USER_RULE'
  | 'REVIEW';
type FixtureOutcomeSource = 'KAKAO' | 'USER_RULE' | 'REVIEW';

type FabricatedMerchantFixture = Readonly<{
  merchantName: string;
  expectedResolutionSource: FixtureResolutionSource;
  place?: PlaceSearchResult;
  hasExactUserRule?: boolean;
}>;

function fabricatedPlace(
  id: string,
  placeName: string,
  categoryName: string,
): PlaceSearchResult {
  return {
    id,
    placeName,
    categoryName,
    categoryGroupCode: '',
    categoryGroupName: '',
    addressName: 'Fabricated parcel address',
    roadAddressName: 'Fabricated road address',
    x: '127.0000',
    y: '37.0000',
  };
}

const convenienceCategory = '가정,생활 > 편의점';
const cafeCategory = '음식점 > 카페 > 커피전문점';

const fabricatedMerchantFixtureV1: readonly FabricatedMerchantFixture[] = [
  {
    merchantName: 'GS25',
    expectedResolutionSource: 'EXACT',
    place: fabricatedPlace('exact-gs25', 'GS25', convenienceCategory),
  },
  {
    merchantName: 'CU',
    expectedResolutionSource: 'EXACT',
    place: fabricatedPlace('exact-cu', 'CU', convenienceCategory),
  },
  {
    merchantName: '7-ELEVEN',
    expectedResolutionSource: 'EXACT',
    place: fabricatedPlace('exact-seven', '7-ELEVEN', convenienceCategory),
  },
  {
    merchantName: '메가MGC커피',
    expectedResolutionSource: 'EXACT',
    place: fabricatedPlace('exact-mega', '메가MGC커피', cafeCategory),
  },
  {
    merchantName: '지에스25 한남대점',
    expectedResolutionSource: 'ALIAS',
    place: fabricatedPlace('alias-gs', 'GS25 한남대점', convenienceCategory),
  },
  {
    merchantName: '지에쓰25',
    expectedResolutionSource: 'ALIAS',
    place: fabricatedPlace('alias-gs-short', 'GS25', convenienceCategory),
  },
  {
    merchantName: '지에쓰이십오 대전법동점',
    expectedResolutionSource: 'ALIAS',
    place: fabricatedPlace(
      'alias-gs-korean-number',
      'GS25 대전법동점',
      convenienceCategory,
    ),
  },
  {
    merchantName: '씨유 한남대점',
    expectedResolutionSource: 'ALIAS',
    place: fabricatedPlace('alias-cu', 'CU 한남대점', convenienceCategory),
  },
  {
    merchantName: '세븐일레븐',
    expectedResolutionSource: 'ALIAS',
    place: fabricatedPlace('alias-seven', '7-ELEVEN', convenienceCategory),
  },
  {
    merchantName: '7일레븐 법동점',
    expectedResolutionSource: 'ALIAS',
    place: fabricatedPlace(
      'alias-seven-number',
      '7-ELEVEN 법동점',
      convenienceCategory,
    ),
  },
  {
    merchantName: '메가엠지씨커피 대전법동점',
    expectedResolutionSource: 'ALIAS',
    place: fabricatedPlace(
      'alias-mega',
      '메가MGC커피 대전법동점',
      cafeCategory,
    ),
  },
  {
    merchantName: '메가엠지시커피 대전법동점',
    expectedResolutionSource: 'FUZZY',
    place: fabricatedPlace(
      'fuzzy-mega',
      '메가MGC커피 대전법동점',
      cafeCategory,
    ),
  },
  {
    merchantName: '지에쓰이십오 대전법동점',
    expectedResolutionSource: 'USER_RULE',
    hasExactUserRule: true,
  },
  {
    merchantName: 'PAYCO오더',
    expectedResolutionSource: 'REVIEW',
  },
];

function countSources<TSource extends string>(
  sources: readonly TSource[],
): Readonly<Record<TSource, number>> {
  return sources.reduce<Record<TSource, number>>(
    (counts, source) => ({
      ...counts,
      [source]: (counts[source] ?? 0) + 1,
    }),
    {} as Record<TSource, number>,
  );
}

function classifyWithBaseline(
  fixture: FabricatedMerchantFixture,
): FixtureOutcomeSource {
  if (fixture.hasExactUserRule === true) return 'USER_RULE';
  if (fixture.place === undefined) return 'REVIEW';

  const hasExactNormalizedMatch =
    normalizeCategoryRuleDescription(fixture.merchantName) ===
    normalizeCategoryRuleDescription(fixture.place.placeName);

  return hasExactNormalizedMatch &&
    mapKakaoCategoryName(fixture.place.categoryName) !== undefined
    ? 'KAKAO'
    : 'REVIEW';
}

function classifyWithResolution(
  fixture: FabricatedMerchantFixture,
): FixtureOutcomeSource {
  if (fixture.hasExactUserRule === true) return 'USER_RULE';
  if (fixture.place === undefined) return 'REVIEW';

  return classifyKakaoPlaceCategory(fixture.merchantName, [fixture.place])
    .status === 'CLASSIFIED'
    ? 'KAKAO'
    : 'REVIEW';
}

describe('Fabricated Merchant Fixture v1 measurement', () => {
  it('reports reproducible before and after source counts without private data', () => {
    const resolutionSources = fabricatedMerchantFixtureV1.map((fixture) =>
      fixture.hasExactUserRule === true
        ? 'USER_RULE'
        : resolveMerchantName(fixture.merchantName).source,
    );
    const beforeOutcomes = fabricatedMerchantFixtureV1.map(classifyWithBaseline);
    const afterOutcomes = fabricatedMerchantFixtureV1.map(classifyWithResolution);

    expect(resolutionSources).toEqual(
      fabricatedMerchantFixtureV1.map(
        (fixture) => fixture.expectedResolutionSource,
      ),
    );
    expect(countSources(resolutionSources)).toEqual({
      EXACT: 4,
      ALIAS: 7,
      FUZZY: 1,
      USER_RULE: 1,
      REVIEW: 1,
    });
    expect(countSources(beforeOutcomes)).toEqual({
      KAKAO: 4,
      USER_RULE: 1,
      REVIEW: 9,
    });
    expect(countSources(afterOutcomes)).toEqual({
      KAKAO: 12,
      USER_RULE: 1,
      REVIEW: 1,
    });
  });
});
