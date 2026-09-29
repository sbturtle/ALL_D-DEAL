import type { BuiltInCategoryId } from './category';
import { normalizeKeywordCategoryRuleText } from './keyword-category-rule';

export type DefaultCategoryKeyword = Readonly<{
  keyword: string;
  categoryId: BuiltInCategoryId;
}>;

type DefaultCategoryKeywordMatch = Readonly<{
  keywordNormalized: string;
  categoryId: BuiltInCategoryId;
}>;

// 널리 알려진 상호와 업종 표식만 둔다. 짧은 영문 약어(CU, KT 등)는 다른 단어에
// 포함되기 쉬워 제외했다. 일치는 포함 비교이며 가장 긴 키워드가 우선한다.
const DEFAULT_CATEGORY_KEYWORD_GROUPS: Readonly<
  Record<BuiltInCategoryId, readonly string[]>
> = {
  CAFE: [
    '스타벅스', 'starbucks', '투썸플레이스', '이디야', '메가커피', '메가mgc',
    '빽다방', '컴포즈커피', '폴바셋', '할리스', '커피빈', '파스쿠찌', '엔제리너스',
    '공차', '블루보틀', '커피', '카페',
  ],
  CONVENIENCE: [
    'gs25', '지에스25', '씨유', '세븐일레븐', '7eleven', '이마트24', 'emart24',
    '미니스톱', '편의점',
  ],
  FOOD_DINING: [
    '버거킹', 'burgerking', '맥도날드', 'mcdonald', '롯데리아', 'kfc', '맘스터치',
    '서브웨이', 'subway', '쉐이크쉑', '배달의민족', '배민', '요기요', '쿠팡이츠',
    '도미노피자', '피자헛', '교촌', 'bhc', 'bbq', '파리바게뜨', '뚜레쥬르',
    '배스킨라빈스', '던킨', '김밥', '떡볶이', '국밥', '치킨', '식당',
  ],
  CULTURE: [
    'cgv', '메가박스', '롯데시네마', '롯데컬처웍스', '인터파크티켓', '교보문고',
    '영풍문고', 'yes24', '알라딘',
  ],
  SHOPPING: [
    '쿠팡', 'coupang', '11번가', '지마켓', 'gmarket', '옥션', '무신사', '올리브영',
    '다이소', '이마트', '홈플러스', '롯데마트', '코스트코', '마켓컬리', 'kurly',
    '에이블리', '지그재그', '알리익스프레스', 'aliexpress', '테무',
  ],
  SUBSCRIPTION: [
    '넷플릭스', 'netflix', '유튜브프리미엄', 'youtube', '스포티파이', 'spotify',
    '멜론', '디즈니플러스', 'disney', '왓챠', '티빙', 'tving', '쿠팡와우',
    '네이버플러스멤버십', 'openai', 'chatgpt', 'applecombill', 'icloud',
  ],
  TRANSPORT: [
    '카카오t', '택시', '티머니', 'tmoney', '코레일', 'korail', '지하철',
    '고속버스', '시외버스', '버스', '주유소', 'sk에너지', 'gs칼텍스', '에쓰오일',
    '현대오일뱅크', '하이패스', '주차',
  ],
  MEDICAL: ['병원', '의원', '약국', '치과', '한의원'],
  HEALTH: ['헬스', '피트니스', '필라테스', '요가'],
  HOUSING_UTILITIES: ['관리비', '한국전력', '도시가스', '상수도'],
  LEISURE: ['노래방', 'pc방', '볼링', '야놀자', '여기어때', '에어비앤비', 'airbnb'],
  EDUCATION: ['학원', '인프런', '클래스101'],
  DATE: [],
  OTHER: [],
};

export const DEFAULT_CATEGORY_KEYWORDS: readonly DefaultCategoryKeyword[] =
  Object.entries(DEFAULT_CATEGORY_KEYWORD_GROUPS).flatMap(
    ([categoryId, keywords]) =>
      keywords.map((keyword) => ({
        keyword,
        categoryId: categoryId as BuiltInCategoryId,
      })),
  );

const DEFAULT_CATEGORY_KEYWORD_MATCHERS: readonly DefaultCategoryKeywordMatch[] =
  DEFAULT_CATEGORY_KEYWORDS.map((entry) => ({
    keywordNormalized: normalizeKeywordCategoryRuleText(entry.keyword),
    categoryId: entry.categoryId,
  })).sort(
    (left, right) =>
      right.keywordNormalized.length - left.keywordNormalized.length ||
      left.keywordNormalized.localeCompare(right.keywordNormalized),
  );

export function findDefaultCategoryKeyword(
  description: string,
): DefaultCategoryKeywordMatch | undefined {
  const descriptionNormalized = normalizeKeywordCategoryRuleText(description);

  if (descriptionNormalized.length === 0) {
    return undefined;
  }

  return DEFAULT_CATEGORY_KEYWORD_MATCHERS.find((matcher) =>
    descriptionNormalized.includes(matcher.keywordNormalized),
  );
}
