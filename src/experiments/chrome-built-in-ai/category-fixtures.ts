import type { ExperimentCategoryId } from './category-prompt';

export type CategoryFixture = Readonly<{
  description: string;
  expectedCategoryId: ExperimentCategoryId;
}>;

// 공개 상호명과 지어낸 일반 상호로 만든 가짜 거래 설명이다. 금액·날짜·카드번호는
// 넣지 않는다. 절반가량은 기본 추천 키워드가 놓치도록 골랐고, 기대 카테고리는
// 작성자의 판단이라 소규모 참고 지표로만 쓴다.
export const CATEGORY_FIXTURES: readonly CategoryFixture[] = [
  { description: '버거킹 강남역점', expectedCategoryId: 'FOOD_DINING' },
  { description: '교촌치킨 역삼점', expectedCategoryId: 'FOOD_DINING' },
  { description: '본죽 선릉점', expectedCategoryId: 'FOOD_DINING' },
  { description: '한솥 테헤란로점', expectedCategoryId: 'FOOD_DINING' },
  { description: '이삭토스트 서초점', expectedCategoryId: 'FOOD_DINING' },
  { description: '노랑통닭 논현점', expectedCategoryId: 'FOOD_DINING' },
  { description: '봉피양 방이점', expectedCategoryId: 'FOOD_DINING' },
  { description: '할매순두부', expectedCategoryId: 'FOOD_DINING' },
  { description: '샐러디 삼성점', expectedCategoryId: 'FOOD_DINING' },
  { description: '우아한형제들', expectedCategoryId: 'FOOD_DINING' },

  { description: '스타벅스 역삼역점', expectedCategoryId: 'CAFE' },
  { description: '메가MGC커피 신논현', expectedCategoryId: 'CAFE' },
  { description: '투썸플레이스 잠실', expectedCategoryId: 'CAFE' },
  { description: '바나프레소 강남', expectedCategoryId: 'CAFE' },
  { description: '탐앤탐스 서초', expectedCategoryId: 'CAFE' },
  { description: '설빙 홍대점', expectedCategoryId: 'CAFE' },

  { description: 'GS25 역삼점', expectedCategoryId: 'CONVENIENCE' },
  { description: '세븐일레븐 선릉', expectedCategoryId: 'CONVENIENCE' },
  { description: 'CU 강남대로점', expectedCategoryId: 'CONVENIENCE' },
  { description: '코리아세븐', expectedCategoryId: 'CONVENIENCE' },

  { description: '카카오T 일반택시', expectedCategoryId: 'TRANSPORT' },
  { description: '코레일 KTX', expectedCategoryId: 'TRANSPORT' },
  { description: '에스알 SRT', expectedCategoryId: 'TRANSPORT' },
  { description: '한국도로공사', expectedCategoryId: 'TRANSPORT' },
  { description: '제주항공', expectedCategoryId: 'TRANSPORT' },
  { description: 'GS칼텍스 역삼주유소', expectedCategoryId: 'TRANSPORT' },
  { description: '티머니 충전', expectedCategoryId: 'TRANSPORT' },

  { description: '한국전력공사', expectedCategoryId: 'HOUSING_UTILITIES' },
  { description: '서울도시가스', expectedCategoryId: 'HOUSING_UTILITIES' },
  { description: '아파트관리사무소', expectedCategoryId: 'HOUSING_UTILITIES' },
  { description: 'SK브로드밴드', expectedCategoryId: 'HOUSING_UTILITIES' },
  { description: 'LG헬로비전', expectedCategoryId: 'HOUSING_UTILITIES' },
  { description: '(주)케이티', expectedCategoryId: 'HOUSING_UTILITIES' },

  { description: '쿠팡', expectedCategoryId: 'SHOPPING' },
  { description: '무신사', expectedCategoryId: 'SHOPPING' },
  { description: '다이소 역삼점', expectedCategoryId: 'SHOPPING' },
  { description: '하이마트 서초점', expectedCategoryId: 'SHOPPING' },
  { description: '무인양품 강남', expectedCategoryId: 'SHOPPING' },
  { description: '자라 코엑스점', expectedCategoryId: 'SHOPPING' },
  { description: '나이키 공식몰', expectedCategoryId: 'SHOPPING' },
  { description: 'SSG.COM', expectedCategoryId: 'SHOPPING' },
  { description: 'CJ온스타일', expectedCategoryId: 'SHOPPING' },
  { description: '커피머신 전문몰', expectedCategoryId: 'SHOPPING' },

  { description: '바른자세필라테스', expectedCategoryId: 'HEALTH' },
  { description: '스포애니 역삼점', expectedCategoryId: 'HEALTH' },
  { description: '더클라이밍 강남', expectedCategoryId: 'HEALTH' },
  { description: '올림픽수영장', expectedCategoryId: 'HEALTH' },

  { description: '해커스어학원', expectedCategoryId: 'EDUCATION' },
  { description: '인프런', expectedCategoryId: 'EDUCATION' },
  { description: '패스트캠퍼스', expectedCategoryId: 'EDUCATION' },
  { description: '야나두', expectedCategoryId: 'EDUCATION' },
  { description: 'YBM 토익 접수', expectedCategoryId: 'EDUCATION' },

  { description: '코인노래연습장', expectedCategoryId: 'LEISURE' },
  { description: '여기어때', expectedCategoryId: 'LEISURE' },
  { description: '롯데월드 어드벤처', expectedCategoryId: 'LEISURE' },
  { description: '에버랜드', expectedCategoryId: 'LEISURE' },
  { description: '스파랜드 센텀', expectedCategoryId: 'LEISURE' },

  { description: 'CGV 강남', expectedCategoryId: 'CULTURE' },
  { description: '교보문고 광화문', expectedCategoryId: 'CULTURE' },
  { description: '예술의전당', expectedCategoryId: 'CULTURE' },
  { description: '티켓링크', expectedCategoryId: 'CULTURE' },
  { description: '국립중앙박물관', expectedCategoryId: 'CULTURE' },
  { description: '버스킹 공연 티켓', expectedCategoryId: 'CULTURE' },

  { description: '튼튼내과의원', expectedCategoryId: 'MEDICAL' },
  { description: '온누리약국', expectedCategoryId: 'MEDICAL' },
  { description: '바른정형외과', expectedCategoryId: 'MEDICAL' },
  { description: '밝은이비인후과', expectedCategoryId: 'MEDICAL' },
  { description: '강남세브란스', expectedCategoryId: 'MEDICAL' },

  { description: '넷플릭스', expectedCategoryId: 'SUBSCRIPTION' },
  { description: '유튜브프리미엄', expectedCategoryId: 'SUBSCRIPTION' },
  { description: '웨이브 wavve', expectedCategoryId: 'SUBSCRIPTION' },
  { description: '라프텔', expectedCategoryId: 'SUBSCRIPTION' },
  { description: '쿠팡플레이', expectedCategoryId: 'SUBSCRIPTION' },
  { description: '애플뮤직', expectedCategoryId: 'SUBSCRIPTION' },
  { description: '지니뮤직', expectedCategoryId: 'SUBSCRIPTION' },

  { description: '우체국 택배', expectedCategoryId: 'OTHER' },
  { description: '크린토피아 세탁', expectedCategoryId: 'OTHER' },
  { description: '주민센터 민원발급', expectedCategoryId: 'OTHER' },
  { description: '강남구청 과태료', expectedCategoryId: 'OTHER' },
];
