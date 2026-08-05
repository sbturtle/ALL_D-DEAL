import type { PlaceSearch, PlaceSearchResult } from '../../application/places/place-search';

type KakaoPlace = Readonly<{
  id: string;
  place_name: string;
  address_name: string;
  road_address_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  x: string;
  y: string;
}>;

type KakaoPlaces = Readonly<{
  keywordSearch: (
    query: string,
    callback: (places: readonly KakaoPlace[], status: string) => void,
  ) => void;
}>;

export type KakaoMapSdk = Readonly<{
  maps: Readonly<{
    load: (callback: () => void) => void;
    services: Readonly<{
      Places: new () => KakaoPlaces;
      Status: Readonly<{ OK: string }>;
    }>;
  }>;
}>;

export type KakaoMapSdkLoader = () => Promise<KakaoMapSdk>;

export function createKakaoMapPlaceSearch(
  loadSdk: KakaoMapSdkLoader,
): PlaceSearch {
  return async (query) => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length === 0) {
      return [];
    }

    const sdk = await loadSdk();

    return new Promise((resolve) => {
      new sdk.maps.services.Places().keywordSearch(
        normalizedQuery,
        (places, status) => {
          if (status !== sdk.maps.services.Status.OK) {
            resolve([]);
            return;
          }

          resolve(
            places.slice(0, 5).map(
              (place): PlaceSearchResult => ({
                id: place.id,
                placeName: place.place_name,
                categoryName: place.category_name,
                categoryGroupCode: place.category_group_code,
                categoryGroupName: place.category_group_name,
                addressName: place.address_name,
                roadAddressName: place.road_address_name,
                x: place.x,
                y: place.y,
              }),
            ),
          );
        },
      );
    });
  };
}
