export type PlaceSearchResult = Readonly<{
  id: string;
  placeName: string;
  categoryName: string;
  categoryGroupCode: string;
  categoryGroupName: string;
  addressName: string;
  roadAddressName: string;
  x: string;
  y: string;
}>;

export type PlaceSearch = (
  query: string,
) => Promise<readonly PlaceSearchResult[]>;
