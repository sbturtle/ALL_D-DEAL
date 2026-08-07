import { describe, expect, it, vi } from 'vitest';

import type { PlaceSearchResult } from './place-search';
import { analyzeMerchantWithKakao } from './analyze-merchant-with-kakao';

function fabricatedPlace(
  placeName: string,
  categoryName = '가정,생활 > 편의점 > GS25',
): PlaceSearchResult {
  return {
    id: `${placeName}-${categoryName}`,
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

describe('analyzeMerchantWithKakao', () => {
  it('tries raw, normalized, and canonical queries in order until classification', async () => {
    const searchPlaces = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([fabricatedPlace('Fabricated Other Store')])
      .mockResolvedValueOnce([fabricatedPlace('GS25 대전법동점')]);

    const analysis = await analyzeMerchantWithKakao(
      '지에쓰이십오(대전법동점)',
      searchPlaces,
    );

    expect(searchPlaces.mock.calls.map(([query]) => query)).toEqual([
      '지에쓰이십오(대전법동점)',
      '지에쓰이십오 대전법동점',
      'GS25 대전법동점',
    ]);
    expect(analysis.classification).toMatchObject({
      status: 'CLASSIFIED',
      categoryId: 'CONVENIENCE',
    });
    expect(analysis.trace).toMatchObject({
      original: '지에쓰이십오(대전법동점)',
      normalized: '지에쓰이십오 대전법동점',
      resolutionSource: 'ALIAS',
      matchedAlias: '지에쓰이십오',
      canonicalQuery: 'GS25 대전법동점',
      matchedQuery: 'GS25 대전법동점',
      mappedCategoryId: 'CONVENIENCE',
    });
    expect(analysis.trace.attempts).toHaveLength(3);
  });

  it('stops after a canonical-equivalent place is classified', async () => {
    const searchPlaces = vi
      .fn()
      .mockResolvedValue([fabricatedPlace('GS25 대전법동점')]);

    const analysis = await analyzeMerchantWithKakao(
      '지에쓰이십오 대전법동점',
      searchPlaces,
    );

    expect(searchPlaces).toHaveBeenCalledTimes(1);
    expect(analysis.classification.status).toBe('CLASSIFIED');
  });

  it('deduplicates equal query forms and never exceeds three attempts', async () => {
    const searchPlaces = vi.fn().mockResolvedValue([]);

    const analysis = await analyzeMerchantWithKakao('GS25', searchPlaces);

    expect(searchPlaces).toHaveBeenCalledTimes(1);
    expect(searchPlaces).toHaveBeenCalledWith('GS25');
    expect(analysis.trace.attempts).toHaveLength(1);
    expect(analysis.classification).toMatchObject({
      status: 'NEEDS_REVIEW',
      reason: 'NO_EXACT_MERCHANT_MATCH',
    });
  });

  it('does not query a payment intermediary', async () => {
    const searchPlaces = vi.fn();

    const analysis = await analyzeMerchantWithKakao(
      'PAYCO오더',
      searchPlaces,
    );

    expect(searchPlaces).not.toHaveBeenCalled();
    expect(analysis.trace.attempts).toEqual([]);
    expect(analysis.classification).toMatchObject({
      status: 'NEEDS_REVIEW',
      source: 'NOT_QUERIED',
      reason: 'PAYMENT_INTERMEDIARY',
    });
  });

  it('keeps an earlier unmapped canonical place as the final review reason', async () => {
    const unmappedPlace = fabricatedPlace('GS25 대전법동점', '숙박 > 호텔');
    const searchPlaces = vi
      .fn()
      .mockResolvedValueOnce([unmappedPlace])
      .mockResolvedValueOnce([]);

    const analysis = await analyzeMerchantWithKakao(
      '지에쓰이십오 대전법동점',
      searchPlaces,
    );

    expect(analysis.classification).toMatchObject({
      status: 'NEEDS_REVIEW',
      reason: 'UNMAPPED_KAKAO_CATEGORY',
      place: unmappedPlace,
    });
    expect(analysis.trace.finalReviewReason).toBe('UNMAPPED_KAKAO_CATEGORY');
  });

  it('stops fallback attempts when the provider rejects', async () => {
    const searchPlaces = vi.fn().mockRejectedValue(new Error('provider failed'));

    await expect(
      analyzeMerchantWithKakao(
        '지에쓰이십오 대전법동점',
        searchPlaces,
      ),
    ).rejects.toThrow('provider failed');
    expect(searchPlaces).toHaveBeenCalledTimes(1);
  });

  it('stops after an active preview aborts between fallback attempts', async () => {
    const controller = new AbortController();
    const searchPlaces = vi.fn().mockImplementation(async () => {
      controller.abort();
      return [];
    });

    await expect(
      analyzeMerchantWithKakao(
        '지에쓰이십오 대전법동점',
        searchPlaces,
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(searchPlaces).toHaveBeenCalledTimes(1);
  });
});
