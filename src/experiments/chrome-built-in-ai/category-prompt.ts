import { CATEGORY_IDS, type BuiltInCategoryId } from '../../domain/categories/category';
import { CATEGORY_PRESENTATIONS } from '../../domain/categories/category-presentation';

// 데이트는 거래 설명만으로 알 수 없는 맥락 분류라 모델 선택지에서 뺀다.
export type ExperimentCategoryId = Exclude<BuiltInCategoryId, 'DATE'>;

export const EXPERIMENT_CATEGORY_IDS: readonly ExperimentCategoryId[] =
  CATEGORY_IDS.filter((id): id is ExperimentCategoryId => id !== 'DATE');

export const UNKNOWN_CATEGORY_RESPONSE = 'UNKNOWN';

export const CATEGORY_RESPONSE_CONSTRAINT = {
  type: 'string',
  enum: [...EXPERIMENT_CATEGORY_IDS, UNKNOWN_CATEGORY_RESPONSE],
} as const;

// 상호 예시를 넣으면 fixture 결과가 부풀려지므로 업종 설명만 쓴다.
const CATEGORY_GUIDES: Readonly<Record<ExperimentCategoryId, string>> = {
  FOOD_DINING: 'restaurants, food delivery apps, fast food, bakeries, snack bars',
  CAFE: 'coffee shops, tea shops, dessert and shaved-ice cafes',
  CONVENIENCE: 'convenience store chains',
  TRANSPORT: 'taxi, subway, bus, trains, flights, fuel stations, tolls, parking',
  HOUSING_UTILITIES:
    'rent, apartment management fees, electricity, gas, water, telecom and internet bills',
  SHOPPING:
    'online marketplaces, supermarkets, department stores, clothing, cosmetics, electronics, household goods',
  HEALTH: 'gyms, fitness, pilates, yoga, swimming pools, climbing and other sports facilities',
  EDUCATION: 'academies, language schools, online courses, exam registration fees',
  LEISURE: 'karaoke, PC rooms, amusement parks, spas, lodging and travel bookings',
  CULTURE: 'movies, books, performances, concerts, museums, ticket sellers',
  MEDICAL: 'hospitals, clinics, dentists, pharmacies',
  SUBSCRIPTION: 'recurring digital services: video or music streaming, software, app stores',
  OTHER: 'post office, laundry, government and civil service fees, other services',
};

export const CATEGORY_SYSTEM_PROMPT = [
  'You classify one Korean card or bank transaction description into a spending category for a personal budget app.',
  'The description is usually a merchant name, sometimes with a branch name or a company name.',
  `Answer with exactly one category ID. Answer ${UNKNOWN_CATEGORY_RESPONSE} when the description does not reveal the kind of business.`,
  '',
  'Categories:',
  ...EXPERIMENT_CATEGORY_IDS.map(
    (id) => `- ${id} (${CATEGORY_PRESENTATIONS[id].label}): ${CATEGORY_GUIDES[id]}`,
  ),
].join('\n');

export function buildCategoryUserPrompt(description: string): string {
  return `Transaction description: ${description}`;
}

export type CategoryPrediction =
  | Readonly<{ kind: 'CATEGORY'; categoryId: ExperimentCategoryId }>
  | Readonly<{ kind: 'UNKNOWN' }>
  | Readonly<{ kind: 'INVALID'; raw: string }>;

const experimentCategoryIdSet: ReadonlySet<string> = new Set(EXPERIMENT_CATEGORY_IDS);

function isExperimentCategoryId(value: unknown): value is ExperimentCategoryId {
  return typeof value === 'string' && experimentCategoryIdSet.has(value);
}

/** `responseConstraint`가 강제한 JSON 문자열 응답만 받아들이고 나머지는 INVALID로 둔다. */
export function parseCategoryResponse(raw: string): CategoryPrediction {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'INVALID', raw };
  }

  if (parsed === UNKNOWN_CATEGORY_RESPONSE) {
    return { kind: 'UNKNOWN' };
  }

  return isExperimentCategoryId(parsed)
    ? { kind: 'CATEGORY', categoryId: parsed }
    : { kind: 'INVALID', raw };
}
