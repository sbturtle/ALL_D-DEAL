# 가맹점 이름 해석 계약

- 상태: 8C단계 구현 완료
- 작성일: 2026-08-07
- 관련 문서: [ADR-0012](../adr/ADR-0012-merchant-entity-resolution-before-vector-search.md), [사용자 확인형 카테고리 규칙 계약](category-rule-contract.md)

## 목적과 경계

카드 XLS의 `descriptionOriginal`을 Kakao 검색용 가맹점 입력으로 사용할 때 같은 브랜드의 표기 차이를 안전한 canonical query로 바꾼다. 원본 Transaction을 수정하거나 새 Merchant 필드를 저장하는 기능은 아니다.

```text
정확히 확인된 CategoryRule
  → 결제중개자 차단
  → 정규화
  → 정확한 canonical/alias 선두 일치
  → 제한된 fuzzy alias 대체 경로
  → 원문·정규화·canonical Kakao 검색어(최대 3개)
  → 카테고리 제안 또는 검토
```

정확한 CategoryRule은 별도 Application 단계에서 가장 먼저 적용한다. 일치하면 나머지 해석 과정과 외부 호출을 건너뛴다.

## 정규화

`normalizeMerchantName`은 다음 세 값을 만든다.

| 값 | 계약 |
| --- | --- |
| `original` | 입력 문자열을 그대로 보존한다. |
| `normalized` | Unicode NFKC 후 문자·숫자가 아닌 기호를 공백으로 바꾸고 공백을 합친 표시값이다. |
| `comparisonKey` | `normalized`를 소문자로 바꾸고 공백을 제거한 비교 전용 값이다. |

범용 한국어 숫자 변환, 법인 래퍼 제거, 지점 접미사 삭제처럼 의미를 바꿀 수 있는 처리는 하지 않는다.

## Alias 목록과 지점명 보존

Alias는 `src/domain/merchants/merchant-alias-registry.ts` 한 곳에서 관리한다.

| 표준 이름 | 허용 Alias |
| --- | --- |
| `GS25` | `GS25`, `지에스25`, `지에쓰25`, `지에쓰이십오` |
| `CU` | `CU`, `씨유` |
| `7-ELEVEN` | `7-ELEVEN`, `세븐일레븐`, `7일레븐` |
| `메가MGC커피` | `메가MGC커피`, `메가엠지씨커피`, `메가커피` |

가장 긴 선두 Alias부터 비교하고, 명시적인 경계 뒤의 지점명을 보존한다. 공백 없는 지점명은 두 글자 이상이면서 `점`, `지점`, `점포`로 끝나는 제한된 경우만 허용한다. 따라서 `지에쓰이십오 대전법동점`은 `GS25 대전법동점`이 되지만 `CUBE`를 `CU BE`로 해석하지 않는다.

## 제한된 fuzzy 대체 경로

Fuzzy는 Alias 정확 일치가 없을 때만 목록 후보에 적용한다.

- 비교 Alias 길이: 6자 이상
- Unicode 문자 단위 Levenshtein 편집 거리: 1 이하
- 최소 유사도: `0.82`
- 최고 후보와 차점의 최소 차이: `0.05`
- 결과: 안전한 단일 후보만 `FUZZY / MEDIUM`, 나머지는 `REVIEW`

Fuzzy는 전국 사업자 검색이나 Kakao 장소명 유사 비교가 아니다. 입력을 canonical 검색어 후보로 바꾸는 제한된 대체 경로다.

## 결제중개자 차단

`PAYCO오더`, 네이버페이, 카카오페이, 토스페이, KG이니시스는 실제 상점이 아닌 중간 결제 표식일 수 있다. NFKC·기호 정리 후의 comparison key에 이런 표식이 포함되면 `REVIEW / PAYMENT_INTERMEDIARY`, `canSearchKakao: false`를 반환한다. Alias·Fuzzy·Kakao 어느 단계에도 전달하지 않는다.

## Kakao 검색과 분류

한 후보는 원문을 다듬은 값, `normalized`, `canonicalQuery` 순서로 검색한다. 빈 값과 같은 문자열은 제거하고 최대 3회까지만 순차 검색하며 `CLASSIFIED` 결과에서 멈춘다. 한 파일의 후보 분석은 최대 3개 작업자로 제한한다.

Kakao 장소는 다음 중 하나일 때만 같은 가맹점으로 본다.

1. 원문 가맹점과 장소명의 comparison key가 정확히 같다.
2. 입력과 장소명이 각각 안전하게 같은 canonical query가 된다. 이때 입력만 Fuzzy였다면 제안 신뢰도는 `MEDIUM`, Exact·Alias였다면 `HIGH`다.

첫 번째 원문 정확 일치 경로는 Merchant resolver 출처와 무관하게 `HIGH`다. Kakao 장소명 자체가 Fuzzy로만 맞는 경우는 채택하지 않는다. 일치 장소 중 매핑 가능한 `category_name`을 우선하고, 일치하지만 매핑되지 않는 장소는 검토 근거로 보존한다. 주소와 좌표는 장소 검증용이며 분류 입력은 `category_name`이다.

## Preview 분석 과정과 취소

Preview의 `Merchant 분석 과정`은 기본적으로 접혀 있다. 펼치면 original, normalized, 해석 출처, matched Alias, canonical query, 각 검색 시도·결과 수, 일치 장소·Kakao 카테고리·내부 카테고리 또는 검토 이유를 보여준다.

새 파일을 선택하거나 Preview를 지우면 기존 `AbortController`와 요청 세대를 무효화한다. Kakao Web SDK가 이미 시작한 callback 검색 자체는 취소할 수 없지만, 완료 직후 중단 상태를 확인해 후속 대체 검색과 이전 결과의 상태 반영을 막는다. 분석 과정, Kakao 응답과 분석 상태는 메모리에만 두고 Import 확정 시 폐기한다.

## 가짜 Fixture 측정

Fabricated Merchant Fixture v1은 14건이며 실제 거래나 Kakao API 응답을 포함하지 않는다.

| 측정 항목 | 결과 |
| --- | --- |
| 해석 출처 | EXACT 4, ALIAS 7, FUZZY 1, USER_RULE 1, REVIEW 1 |
| 7B단계 기준 분류기 | KAKAO 4, USER_RULE 1, REVIEW 9 |
| 가짜 장소를 제공한 8C단계 분류기 | KAKAO 12, USER_RULE 1, REVIEW 1 |

마지막 두 줄은 각 Fixture에 미리 제공한 가짜 장소 결과를 분류기가 판정한 값이다. 실제 Kakao 검색 성공률, 실거래 자동 분류율 또는 운영 정확도로 해석하지 않는다.

## 후속 보류 작업

- 사용자 관리 Merchant Alias, 성공 Merchant Cache와 삭제·수정 UI
- 사용자 수정 한 건에서 브랜드 Alias를 안전하게 학습하는 정책
- 법인 래퍼·영업 접미사 정리 규칙
- 검증된 잔여 문제가 쌓인 뒤의 Vector·Embedding 검토
