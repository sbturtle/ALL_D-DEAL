export type PlaceSearchResult = Readonly<{
  id: string;
  name: string;
  address: string;
  category: string;
}>;

export type PlaceSearch = (
  query: string,
) => Promise<readonly PlaceSearchResult[]>;
