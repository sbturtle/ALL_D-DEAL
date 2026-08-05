import { describe, expect, it, vi } from 'vitest';

import { createKakaoMapPlaceSearch, type KakaoMapSdk } from './kakao-map-place-search';

describe('createKakaoMapPlaceSearch', () => {
  it('searches only the supplied query and returns a short safe result shape', async () => {
    const keywordSearch = vi.fn((query: string, callback: (places: readonly {
      id: string; place_name: string; address_name: string; road_address_name: string;
      category_name: string; category_group_code: string; category_group_name: string;
      x: string; y: string;
    }[], status: string) => void) => {
      expect(query).toBe('Fabricated Cafe');
      callback([{
        id: 'place-1',
        place_name: 'Fabricated Cafe',
        address_name: 'Fabricated parcel address',
        road_address_name: 'Fabricated road address',
        category_name: '음식점 > 카페 > 커피전문점',
        category_group_code: '',
        category_group_name: '',
        x: '127.0000',
        y: '37.0000',
      }], 'OK');
    });
    const sdk = { maps: { load: (callback: () => void) => callback(), services: { Places: class { keywordSearch = keywordSearch; }, Status: { OK: 'OK' } } } } as unknown as KakaoMapSdk;
    const search = createKakaoMapPlaceSearch(async () => sdk);

    await expect(search(' Fabricated Cafe ')).resolves.toEqual([{
      id: 'place-1',
      placeName: 'Fabricated Cafe',
      categoryName: '음식점 > 카페 > 커피전문점',
      categoryGroupCode: '',
      categoryGroupName: '',
      addressName: 'Fabricated parcel address',
      roadAddressName: 'Fabricated road address',
      x: '127.0000',
      y: '37.0000',
    }]);
  });

  it('does not load the SDK for an empty query', async () => {
    const loadSdk = vi.fn();
    await expect(createKakaoMapPlaceSearch(loadSdk)('   ')).resolves.toEqual([]);
    expect(loadSdk).not.toHaveBeenCalled();
  });
});
