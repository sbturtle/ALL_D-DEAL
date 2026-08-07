# ADR-0012 Vector Search보다 Merchant Entity Resolution을 우선한다

- Status: Accepted
- Date: 2026-08-07
- Related: [ADR-0007](ADR-0007-confirmed-description-category-rules.md), [ADR-0010](ADR-0010-kakao-map-web-sdk-opt-in-boundary.md)

## Context

Kakao 장소의 `category_name`을 내부 지출 카테고리 제안에 사용하더라도 카드사 Merchant Name과 Kakao Place Name의 표기가 다르면 검색 또는 동일 상호 판정이 실패한다. 현재 확인한 대표 문제는 `지에쓰이십오`와 `GS25`, `씨유`와 `CU`처럼 의미 검색이 아니라 같은 브랜드의 표기 차이다.

Vector DB나 Embedding은 이 문제보다 넓은 의미 유사도를 다루며, 모델·의존성·개인정보 경계를 추가한다. 현재 사용자별 성공 Merchant 저장소나 검증된 대규모 실패 자료도 없으므로 먼저 설명 가능하고 측정 가능한 결정적 해석 계층이 필요하다.

## Decision

1. 저장된 정확 일치 `CategoryRule`을 가장 먼저 적용한다. 규칙이 있으면 Merchant 해석, Fuzzy, Kakao 호출을 모두 건너뛴다.
2. 결제 중개자 표식은 정규화된 비교 키로 먼저 차단한다. `PAYCO오더`, 네이버페이, 카카오페이, 토스페이, KG이니시스와 구두점·전각 변형은 Alias나 Fuzzy 후보가 아니며 Kakao에 보내지 않는다.
3. `MerchantNormalizer`는 원문을 바꾸지 않고 Unicode NFKC, 기호의 공백화, 연속 공백 정리, 소문자·공백 제거 비교 키만 만든다. 법인 표식이나 영업 suffix를 넓게 삭제하는 규칙은 실제 fixture가 생길 때까지 넣지 않는다.
4. 중앙 Alias Registry가 GS25, CU, 7-ELEVEN, 메가MGC커피의 확인된 표기만 canonical 브랜드로 바꾼다. 선두 브랜드만 치환하고 안전한 지점명은 유지한다.
5. Fuzzy는 Exact와 Alias가 실패한 뒤 Registry 안의 길이 6 이상 Alias에만 적용한다. 편집 거리 1 이하, 유사도 0.82 이상, 차점과 0.05 이상 차이인 단일 승자만 `MEDIUM`으로 인정한다. 짧거나 모호한 값은 검토로 보낸다.
6. Kakao 검색은 원문, 정규화 표시값, canonical query 순서로 중복을 제거해 최대 3회 실행하고 분류 가능한 결과에서 멈춘다. 이 횟수는 하나의 기능 내부 검색 전략이며 작업 실패 재시도 횟수와 무관하다.
7. Kakao `category_name`이 제한된 내부 카테고리로 매핑되고 장소명이 원문과 정확히 같거나 양쪽 모두 안전하게 같은 canonical 상호로 해석될 때만 제안한다. 원문과 장소명이 정확히 같으면 `HIGH`, Fuzzy 입력의 canonical 동일성으로 채택하면 `MEDIUM`이다. Kakao 장소명 자체의 Fuzzy 일치는 허용하지 않는다. 주소는 검증용 보조 정보다.
8. Original, Normalized, 해석 출처, canonical query, 시도한 검색어, 일치 장소·Kakao 카테고리·내부 카테고리·검토 이유를 Preview의 접힌 분석 과정으로만 보여준다. 이 trace와 Kakao 결과는 Transaction·IndexedDB·로그에 저장하지 않는다.
9. 현재 `CategoryRule` 외에 Merchant Cache, 성공 이력, 사용자 Merchant Alias를 영속화하지 않는다. 한 번의 사용자 카테고리 수정으로 브랜드 Alias를 자동 생성하지 않으며 특히 결제 중개자를 학습하지 않는다.

이 결정은 ADR-0010의 초기 정확 상호명 비교를 확장한다. Kakao 사용 여부, JavaScript SDK 키 경계, Preview 전용 결과와 사용자 최종 확인 원칙은 그대로 유지한다.

## Considered alternatives

### Vector DB, Embedding 또는 AI 분류

현재 문제는 동일 Entity 표기 변형이므로 과도하다. 새로운 모델·런타임·원격 처리 경계가 생기고 잘못된 유사 상호 연결을 설명하기 어렵다.

### 모든 한글 숫자·법인 표식·영업 suffix를 일반 변환

일부 이름의 실제 의미나 지점명을 손상할 수 있다. 확인된 Alias와 안전한 기계 정규화만 적용한다.

### Fuzzy 결과를 곧바로 카테고리로 확정

오탐이 생활비 분석에 반영될 위험이 크다. Fuzzy는 canonical 검색어 후보만 만들고 Kakao 장소·카테고리 확인과 사용자 검토를 계속 요구한다.

### Kakao 성공 결과를 자동 캐시·학습

저장 스키마, 삭제·수정 UX, 개인정보 보존 기간과 잘못된 결과의 전파 정책이 없다. 별도 Vertical Slice와 ADR 전에는 도입하지 않는다.

## Consequences

- 현재 실패 유형을 작은 순수 함수와 중앙 Registry로 설명하고 회귀 테스트할 수 있다.
- 지점명을 보존한 canonical query로 Kakao 검색 성공 가능성을 높이면서 최대 호출 수를 제한한다.
- 알려지지 않은 브랜드, 매우 짧은 Alias, 법인 wrapper·suffix 변형은 여전히 검토가 필요할 수 있다.
- 파일 하나의 여러 후보는 최대 3개 worker로 분석하지만 각 후보의 fallback 검색은 순차 실행한다.

## Revisit conditions

다음 자료가 명백한 가짜 또는 안전하게 마스킹된 fixture로 축적될 때 별도 결정을 작성한다.

- 사용자 수정 Merchant를 재사용해야 할 반복 사례와 안전한 삭제·수정 UX가 확인됨
- 법인 wrapper·영업 suffix가 잔여 실패의 의미 있는 비중을 차지함
- 현재 Normalize + Alias + 제한적 Fuzzy + Kakao 이후에도 문자열은 다르지만 의미적으로 같은 업종·브랜드 추천 문제가 충분히 많이 남음

마지막 조건이 측정되기 전에는 Vector Search나 Embedding을 도입하지 않는다.
