import { createKakaoMapPlaceSearch } from './kakao-map-place-search';
import { createKakaoMapSdkLoader } from './kakao-map-sdk-loader';
import type { PlaceSearch } from '../../application/places/place-search';

export function getKakaoMapPlaceSearch(
  javascriptKey: string | undefined = import.meta.env.VITE_KAKAO_MAP_JAVASCRIPT_KEY,
): PlaceSearch | undefined {
  const key = javascriptKey?.trim();

  return key === undefined || key.length === 0
    ? undefined
    : createKakaoMapPlaceSearch(createKakaoMapSdkLoader(key));
}
