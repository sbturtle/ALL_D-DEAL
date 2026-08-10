# 사용자 확인형 카테고리 규칙 계약

- 상태: 5단계에서 구현, 8F단계에서 확장
- 최초 작성일: 2026-08-05
- 최근 수정일: 2026-08-07
- 관련 문서: [ADR-0007](../adr/ADR-0007-confirmed-description-category-rules.md), [Merchant Resolution 계약](merchant-resolution-contract.md)

## 초기 카테고리

| ID | 이름 |
| --- | --- |
| `FOOD_DINING` | 식비·외식 |
| `TRANSPORT` | 교통 |
| `HOUSING_UTILITIES` | 주거·공과금 |
| `SHOPPING` | 쇼핑 |
| `HEALTH` | 건강 |
| `EDUCATION` | 교육 |
| `LEISURE` | 여가 |
| `SUBSCRIPTION` | 구독 |
| `OTHER` | 기타 |

`Transaction.categoryId`는 선택 필드다. 값이 없으면 **미분류**로 보며, 기존에 저장된 거래는 레코드 마이그레이션 없이 계속 유효하다.

## 규칙 키와 개인정보 경계

현재 XLS Importer는 신뢰할 수 있는 별도 가맹점 필드를 제공하지 않는다. 따라서 규칙은 `descriptionOriginal`을 정확히 정규화한 키로 비교한다. 정규화 순서는 Unicode NFKC, 소문자 변환, 문장부호·기호의 공백 치환, 연속 공백 축소, 양끝 공백 제거다.

이 키는 가맹점 동일성의 증명값이나 퍼지 매칭값, 암호화 값이 아니다. 정규화 결과가 300자를 넘거나 ASCII 숫자 5개 이상이 연속되면 규칙 생성을 거부한다. 계좌·카드 식별자처럼 보이는 값을 재사용 가능한 파생값으로 저장하지 않기 위해서다. 원본 Import 파일, 파일명, 전체 원본 행과 원격 복사본은 저장하지 않는다.

8C단계 Merchant 정규화와 이 규칙 키는 목적이 다르다. 정확한 설명 규칙은 계속 `normalizeCategoryRuleDescription(descriptionOriginal)`의 정확 일치만 사용하며 Alias·Fuzzy·Kakao 결과로 범위를 넓히지 않는다.

## 사용자가 확인한 키워드 묶기

8F단계는 기존 정확 규칙이나 정확 규칙 키를 바꾸지 않고 별도의 `KeywordCategoryRule`을 추가한다. 키워드는 사용자가 입력한 포함 문구이며 NFKC·대소문자·문장부호·공백 차이를 정규화해 비교한다. 정규화된 길이는 2자 이상 80자 이하이고, 긴 숫자 식별자처럼 보이는 값은 거부한다.

검토 묶기 모달은 카테고리 선택과 최종 확인 전에 현재 실제 일치 건수를 보여준다. 선택한 키워드를 포함하는 로컬 미분류 `EXPENSE`만 변경하고, 이후 Preview에도 키워드를 저장한다. 이미 분류한 거래는 그대로 둔다. `네이버페이`, `오더`, `쿠팡`은 현재 설명에 포함될 때만 선택 가능한 추천으로 보이며, 추천만으로 규칙을 저장하거나 거래를 분류하지 않는다.

정확한 규칙이 항상 우선한다. 정확 규칙이 없으면 Preview는 일치하는 사용자 확인 키워드 중 가장 긴 규칙을 적용하고, 길이가 같으면 사전순으로 안정적으로 결정한다. Import를 확정하기 전에는 Preview 카테고리를 언제든 수정할 수 있다. 키워드 일치는 가맹점 동일성의 증명이 아니며 Kakao 결제중개자 차단 경계를 바꾸지 않는다.

## Preview와 확정 흐름

```text
Legacy XLS Preview
  → 로컬 categoryRules 읽기
  → 정확히 일치하는 카테고리를 Preview에만 채우기
  → 없으면 가장 긴 사용자 확인 키워드 카테고리 채우기
  → 해결되지 않은 지출 후보만 Merchant/Kakao 분석으로 보내기
  → 사용자가 필요에 따라 카테고리 수정
  → “이 설명에 앞으로 적용”을 별도로 선택
  → 선택 후보와 확인된 규칙을 원자적으로 저장
```

- 저장된 규칙은 카테고리 선택기에 표시되며 확정 전 변경할 수 있다.
- 카테고리만 바꾸면 해당 Transaction의 카테고리만 저장하고 규칙은 만들지 않는다.
- 규칙은 카테고리를 고른 후보에서 사용자가 별도로 동의한 경우에만 요청한다.
- 중복 후보로 남아 저장에서 제외된 거래는 카테고리 규칙을 만들 수 없다.
- 같은 정규화 설명에 서로 다른 카테고리로 동의한 요청이 두 개 들어오면 안전하게 확정을 거부하고 기존 레코드를 변경하지 않는다.

## 로컬 저장소

IndexedDB 스키마 v2에서 `matchDescriptionNormalized`를 키로 하는 `categoryRules` 저장소를 추가했다. `CategoryRule`은 다음을 저장한다.

| 필드 | 의미 |
| --- | --- |
| `matchDescriptionNormalized` | 로컬 설명의 정확 비교 키 |
| `categoryId` | 사용자가 확인한 초기 카테고리 |
| `createdAt` | 로컬에서 처음 만든 시각 |
| `updatedAt` | 마지막으로 확정해 교체한 시각 |

`BrowserLedgerRepository.commitImport`는 `ImportBatch`, 선택된 `Transaction`과 확인된 규칙을 하나의 읽기·쓰기 트랜잭션으로 저장한다. 규칙 교체는 같은 키를 사용하며 기존 Transaction을 바꾸지 않는다. v1 데이터베이스는 빈 `categoryRules` 저장소를 추가하는 방식으로 업그레이드한다.

IndexedDB v2 업그레이드가 차단되면 열기 요청을 즉시 실패시킨다. 종료 이벤트가 오지 않는 요청도 5초 제한 뒤 거부하므로 Dashboard가 무한 로딩에 머물지 않는다. 어떤 실패도 저장 내용을 바꾸지 않는다.

IndexedDB 스키마 v4에는 `keywordNormalized`를 키로 하는 별도 `keywordCategoryRules` 저장소를 추가했다. v1–v3의 모든 저장소와 정확 규칙은 보존한다. `KeywordCategoryRule`은 `keywordNormalized`, `categoryId`, `createdAt`, `updatedAt`을 저장한다. 묶기 사용 사례는 모든 교체 Transaction을 먼저 검증한 뒤 키워드 규칙과 거래 교체를 하나의 읽기·쓰기 트랜잭션으로 저장한다.

## 후속 보류 작업

사용자 정의 카테고리, 규칙 관리 화면, 규칙 삭제, 자동 키워드 학습, 이미 분류한 거래의 일괄 변경, 영속 가맹점 필드 규칙, 사용자 관리 Merchant Alias·Cache, AI 분류와 Dashboard 카테고리 분석은 별도의 결정이 필요하다. 8C단계의 Alias·Fuzzy는 Preview 검색어 해석일 뿐 새 `CategoryRule` 또는 `KeywordCategoryRule`을 자동 생성하지 않는다.
