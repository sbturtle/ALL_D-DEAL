import type { CategoryId } from './category';

export function mapKakaoCategoryName(
  categoryName: string,
): CategoryId | undefined {
  if (/카페|커피전문점/.test(categoryName)) return 'CAFE';
  if (/편의점/.test(categoryName)) return 'CONVENIENCE';
  if (/병원|약국|의료,건강/.test(categoryName)) return 'MEDICAL';
  if (/영화관|문화,예술|사진/.test(categoryName)) return 'CULTURE';
  if (/교통,수송|교통/.test(categoryName)) return 'TRANSPORT';
  if (/음식점/.test(categoryName)) return 'FOOD_DINING';
  return undefined;
}
