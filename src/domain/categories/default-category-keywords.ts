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
    '공차', '블루보틀', '매머드커피', '더벤티', '커피', '카페', '디저트', '빙수',
    '와플',
  ],
  CONVENIENCE: [
    'gs25', '지에스25', '씨유', '세븐일레븐', '7eleven', '이마트24', 'emart24',
    '미니스톱', '편의점',
  ],
  FOOD_DINING: [
    '버거킹', 'burgerking', '맥도날드', 'mcdonald', '롯데리아', 'kfc', '맘스터치',
    '서브웨이', 'subway', '쉐이크쉑', '배달의민족', '배민', '요기요', '쿠팡이츠',
    '도미노피자', '피자헛', '교촌', 'bhc', 'bbq', '파리바게뜨', '뚜레쥬르',
    '배스킨라빈스', '던킨', '베이커리', '제과', '김밥', '떡볶이', '분식', '국밥',
    '해장국', '감자탕', '순대', '찌개', '마라탕', '마라샹궈', '칼국수', '국수',
    '냉면', '쌀국수', '짜장', '짬뽕', '중국집', '반점', '돈까스', '돈가스', '카츠',
    '초밥', '스시', '라멘', '우동', '샤브', '버거', '피자', '치킨', '족발', '보쌈',
    '곱창', '막창', '삼겹살', '갈비', '고기', '한식', '중식', '일식', '양식',
    '뷔페', '도시락', '포차', '호프', '이자카야', '회관', '식당', '푸드', '키친',
  ],
  CULTURE: [
    'cgv', '메가박스', '롯데시네마', '롯데컬처웍스', '인터파크티켓', '교보문고',
    '영풍문고', 'yes24', '알라딘', '서점',
  ],
  SHOPPING: [
    '쿠팡', 'coupang', '11번가', 'g마켓', '지마켓', 'gmarket', '옥션', 'auction',
    '위메프', '티몬', '무신사', 'musinsa', '올리브영', 'oliveyoung', '다이소',
    'daiso', '이마트', '홈플러스', '롯데마트', '코스트코', 'costco', '마켓컬리',
    'kurly', '에이블리', '지그재그', '29cm', '오늘의집', '이케아', 'ikea',
    '알리익스프레스', 'aliexpress', '테무', 'temu', '신세계', '백화점', '아울렛',
    '유니클로', 'uniqlo', '문구', '마트', '스마트스토어',
  ],
  SUBSCRIPTION: [
    '넷플릭스', 'netflix', '유튜브프리미엄', 'youtube', '스포티파이', 'spotify',
    '멜론', '디즈니플러스', 'disney', '왓챠', '티빙', 'tving', '쿠팡와우',
    '네이버플러스멤버십', '밀리의서재', '리디', 'openai', 'chatgpt', 'anthropic',
    'applecombill', 'icloud', 'itunes', '앱스토어', 'appstore', '구글플레이',
    'googleplay', '구글', 'google', 'microsoft', '마이크로소프트', 'adobe',
    'notion', 'github',
  ],
  TRANSPORT: [
    '카카오t', '카카오모빌리티', '택시', 'uber', '쏘카', 'socar', '티머니',
    'tmoney', '코레일', 'korail', '지하철', '고속버스', '시외버스', '버스',
    '따릉이', '주유', 'sk에너지', 'gs칼텍스', '에쓰오일', '현대오일뱅크', '충전소',
    '하이패스', '주차', '대리운전',
  ],
  MEDICAL: [
    '병원', '의원', '약국', '치과', '한의원', '클리닉', '메디컬', '안과', '내과',
    '피부과', '보건소',
  ],
  HEALTH: ['헬스', '피트니스', '필라테스', '요가', '크로스핏'],
  HOUSING_UTILITIES: [
    '관리비', '한국전력', '도시가스', '상수도', 'sk텔레콤', '에스케이텔레콤',
    'lg유플러스', '유플러스', 'kt통신', '통신요금',
  ],
  LEISURE: [
    '노래연습장', '코인노래', '노래방', 'pc방', '피씨방', '볼링', '당구',
    '스크린골프', '방탈출', '만화카페', '키즈카페', '야놀자', '여기어때',
    '에어비앤비', 'airbnb',
  ],
  EDUCATION: ['학원', '인프런', '클래스101', '스터디카페', '독서실', 'udemy'],
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

// 결제대행 표식은 실제 상호를 숨기지만 대부분 온라인 구매라 쇼핑으로 추천한다.
// 설명에 실제 상호 키워드가 함께 있으면 그 상호가 우선하도록 마지막에만 비교한다.
export const PAYMENT_INTERMEDIARY_FALLBACK_KEYWORDS: readonly DefaultCategoryKeyword[] = [
  '네이버페이', 'naverpay', '카카오페이', 'kakaopay', '토스페이', '토스페이먼츠',
  '이니시스', 'inicis', 'nhnkcp', '다날', 'payco',
].map((keyword) => ({ keyword, categoryId: 'SHOPPING' }));

function toSortedMatchers(
  entries: readonly DefaultCategoryKeyword[],
): readonly DefaultCategoryKeywordMatch[] {
  return entries
    .map((entry) => ({
      keywordNormalized: normalizeKeywordCategoryRuleText(entry.keyword),
      categoryId: entry.categoryId,
    }))
    .sort(
      (left, right) =>
        right.keywordNormalized.length - left.keywordNormalized.length ||
        left.keywordNormalized.localeCompare(right.keywordNormalized),
    );
}

const DEFAULT_CATEGORY_KEYWORD_MATCHERS = toSortedMatchers(DEFAULT_CATEGORY_KEYWORDS);
const PAYMENT_INTERMEDIARY_MATCHERS = toSortedMatchers(
  PAYMENT_INTERMEDIARY_FALLBACK_KEYWORDS,
);

export function findDefaultCategoryKeyword(
  description: string,
): DefaultCategoryKeywordMatch | undefined {
  const descriptionNormalized = normalizeKeywordCategoryRuleText(description);

  if (descriptionNormalized.length === 0) {
    return undefined;
  }

  const includesKeyword = (matcher: DefaultCategoryKeywordMatch) =>
    descriptionNormalized.includes(matcher.keywordNormalized);

  return (
    DEFAULT_CATEGORY_KEYWORD_MATCHERS.find(includesKeyword) ??
    PAYMENT_INTERMEDIARY_MATCHERS.find(includesKeyword)
  );
}
