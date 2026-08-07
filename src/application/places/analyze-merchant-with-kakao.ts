import {
  classifyKakaoPlaceCategory,
  type KakaoPlaceCategoryClassification,
  type KakaoPlaceCategoryReviewReason,
} from '../../domain/categories/kakao-place-category-classifier';
import type { CategoryId } from '../../domain/categories/category';
import {
  resolveMerchantName,
  type MerchantNameResolution,
  type MerchantResolutionSource,
} from '../../domain/merchants/merchant-name-resolver';
import type { PlaceSearch, PlaceSearchResult } from './place-search';

export type MerchantKakaoQueryKind = 'RAW' | 'NORMALIZED' | 'CANONICAL';

export type MerchantKakaoAttempt = Readonly<{
  kind: MerchantKakaoQueryKind;
  query: string;
  resultCount: number;
  classification: KakaoPlaceCategoryClassification;
}>;

export type MerchantKakaoTrace = Readonly<{
  original: string;
  normalized: string;
  resolutionSource: MerchantResolutionSource;
  canonicalQuery: string;
  attempts: readonly MerchantKakaoAttempt[];
  matchedAlias?: string;
  matchedQuery?: string;
  matchedPlaceName?: string;
  kakaoCategoryName?: string;
  mappedCategoryId?: CategoryId;
  finalReviewReason?: KakaoPlaceCategoryReviewReason;
}>;

export type MerchantKakaoAnalysis = Readonly<{
  results: readonly PlaceSearchResult[];
  resolution: MerchantNameResolution;
  classification: KakaoPlaceCategoryClassification;
  trace: MerchantKakaoTrace;
}>;

export type MerchantKakaoAnalysisOptions = Readonly<{
  signal?: AbortSignal;
}>;

type MerchantQuery = Readonly<{
  kind: MerchantKakaoQueryKind;
  query: string;
}>;

function createMerchantQueries(
  merchantName: string,
  resolution: MerchantNameResolution,
): readonly MerchantQuery[] {
  const candidates: readonly MerchantQuery[] = [
    { kind: 'RAW', query: merchantName.trim() },
    { kind: 'NORMALIZED', query: resolution.normalized },
    { kind: 'CANONICAL', query: resolution.canonicalQuery },
  ];
  const seenQueries = new Set<string>();

  return candidates.flatMap((candidate) => {
    if (candidate.query.length === 0 || seenQueries.has(candidate.query)) {
      return [];
    }

    seenQueries.add(candidate.query);
    return [candidate];
  }).slice(0, 3);
}

function appendUniquePlaces(
  placesById: Map<string, PlaceSearchResult>,
  places: readonly PlaceSearchResult[],
): void {
  places.forEach((place) => {
    if (!placesById.has(place.id)) {
      placesById.set(place.id, place);
    }
  });
}

function getPreferredReview(
  current: KakaoPlaceCategoryClassification,
  candidate: KakaoPlaceCategoryClassification,
): KakaoPlaceCategoryClassification {
  return candidate.status === 'NEEDS_REVIEW' &&
    candidate.reason === 'UNMAPPED_KAKAO_CATEGORY'
    ? candidate
    : current;
}

function createTrace(
  resolution: MerchantNameResolution,
  attempts: readonly MerchantKakaoAttempt[],
  classification: KakaoPlaceCategoryClassification,
  matchedQuery?: string,
): MerchantKakaoTrace {
  const place = classification.place;

  return {
    original: resolution.original,
    normalized: resolution.normalized,
    resolutionSource: resolution.source,
    canonicalQuery: resolution.canonicalQuery,
    attempts,
    ...(resolution.matchedAlias === undefined
      ? {}
      : { matchedAlias: resolution.matchedAlias }),
    ...(matchedQuery === undefined ? {} : { matchedQuery }),
    ...(place === undefined
      ? {}
      : {
          matchedPlaceName: place.placeName,
          kakaoCategoryName: place.categoryName,
        }),
    ...(classification.status === 'CLASSIFIED'
      ? { mappedCategoryId: classification.categoryId }
      : { finalReviewReason: classification.reason }),
  };
}

export async function analyzeMerchantWithKakao(
  merchantName: string,
  searchPlaces: PlaceSearch,
  options: MerchantKakaoAnalysisOptions = {},
): Promise<MerchantKakaoAnalysis> {
  const resolution = resolveMerchantName(merchantName);
  let finalClassification = classifyKakaoPlaceCategory(merchantName, []);
  const attempts: MerchantKakaoAttempt[] = [];
  const placesById = new Map<string, PlaceSearchResult>();

  if (!resolution.canSearchKakao) {
    return {
      results: [],
      resolution,
      classification: finalClassification,
      trace: createTrace(resolution, attempts, finalClassification),
    };
  }

  for (const merchantQuery of createMerchantQueries(merchantName, resolution)) {
    options.signal?.throwIfAborted();
    const places = await searchPlaces(merchantQuery.query);
    options.signal?.throwIfAborted();
    appendUniquePlaces(placesById, places);

    const classification = classifyKakaoPlaceCategory(merchantName, places);
    attempts.push({
      ...merchantQuery,
      resultCount: places.length,
      classification,
    });

    if (classification.status === 'CLASSIFIED') {
      return {
        results: Array.from(placesById.values()),
        resolution,
        classification,
        trace: createTrace(
          resolution,
          attempts,
          classification,
          merchantQuery.query,
        ),
      };
    }

    finalClassification = getPreferredReview(
      finalClassification,
      classification,
    );
  }

  return {
    results: Array.from(placesById.values()),
    resolution,
    classification: finalClassification,
    trace: createTrace(resolution, attempts, finalClassification),
  };
}
