import { describe, expect, it, vi } from 'vitest';

import { createKakaoMapPlaceSearch, type KakaoMapSdk } from './kakao-map-place-search';

describe('createKakaoMapPlaceSearch', () => {
  it('searches only the supplied query and returns a short safe result shape', async () => {
    const keywordSearch = vi.fn((query: string, callback: (places: readonly {
      id: string; place_name: string; address_name: string; road_address_name: string; category_name: string;
    }[], status: string) => void) => {
      expect(query).toBe('Fabricated Cafe');
      callback([{ id: 'place-1', place_name: 'Fabricated Cafe', address_name: 'Fabricated address', road_address_name: '', category_name: 'Food' }], 'OK');
    });
    const sdk = { maps: { load: (callback: () => void) => callback(), services: { Places: class { keywordSearch = keywordSearch; }, Status: { OK: 'OK' } } } } as unknown as KakaoMapSdk;
    const search = createKakaoMapPlaceSearch(async () => sdk);

    await expect(search(' Fabricated Cafe ')).resolves.toEqual([{ id: 'place-1', name: 'Fabricated Cafe', address: 'Fabricated address', category: 'Food' }]);
  });

  it('does not load the SDK for an empty query', async () => {
    const loadSdk = vi.fn();
    await expect(createKakaoMapPlaceSearch(loadSdk)('   ')).resolves.toEqual([]);
    expect(loadSdk).not.toHaveBeenCalled();
  });
});
