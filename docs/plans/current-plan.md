# 10B단계 — 거래별 자금통과 자금통별 지출 집계

- 상태: `IN_PROGRESS`
- 계획 갱신일: 2026-08-10
- 선행 단계: 10A단계 다대다 공동결제 정산 `DONE`

## 목표

지출 카테고리와 별개로 거래가 어느 자금 목적에 속하는지 나타내는 `BudgetBucket`을 도입한다. 기본 자금통별 지출을 안전하게 집계하고, 기존 생활비는 `LIVING` 자금통의 지출만 뜻하도록 바꾼다.

## 범위와 결정

1. `BudgetBucket`은 카테고리와 별도 Domain 모델이다. 초기 기본값은 `LIVING`, `IRREGULAR`, `EMERGENCY`, `SAVING`, `HOUSING_MARRIAGE`, `INVESTMENT`, `OTHER`이며, Transaction에는 미래 사용자 정의 ID도 수용할 수 있는 문자열 ID를 둔다.
2. 이번 MVP는 Transaction 하나에 `budgetBucketId` 하나만 저장한다. `TransactionAllocation[]` 금액 분할, 자금통 생성·보관·예산 목표 관리와 자동 Merchant 규칙은 후속 단계로 남긴다.
3. 새 `EXPENSE + OUTFLOW` Import 후보는 추천 기본값 `LIVING`을 가진다. 사용자는 저장된 거래의 편집 시트에서 카테고리와 독립적으로 자금통을 바꿀 수 있다. 수입에도 같은 선택 필드를 둘 수 있어 향후 수입 배분을 막지 않는다.
4. IndexedDB v6 업그레이드는 자금통이 없는 기존 `EXPENSE + OUTFLOW` 거래에 `LIVING`을 넣는다. 그 외 기존 거래는 값을 추정하지 않고 그대로 보존한다.
5. 자금통별 집계는 일반 지출을 별도로 계산하고, 기존 생활비 카드·목표·주간 그래프는 `LIVING`만 사용한다. 다대다 공동결제에 여러 자금통이 섞인 경우의 정산금 배분은 자동 추정하지 않고, 이번 슬라이스에서는 기존 생활비 정산 동작을 보존한다.
6. Home에는 대규모 재설계 대신 자금통별 지출의 작은 요약 목록을 추가한다. Import Preview는 기본 자금통을 표시하되, Preview별 변경 UI는 후속 단계로 남긴다.

## 완료 조건

1. 카테고리와 자금통은 별도 타입·검증·표현을 갖는다.
2. Transaction마다 `budgetBucketId`를 저장·검증하고 기존 데이터는 v6에서 안전하게 읽힌다.
3. 기본 지출은 `LIVING`으로 추천되지만 편집 시트에서 `IRREGULAR`, `EMERGENCY` 등으로 변경할 수 있다.
4. 예시의 카페·식사·축의금·병원비는 전체 소비와 생활비·비정기비·비상금이 각각 올바르게 집계된다.
5. Home의 생활비 표시는 모든 지출이 아니라 `LIVING` 자금통만 사용하며, 자금통별 작은 요약을 확인할 수 있다.
6. 관련 요구사항, ADR, 아키텍처·데이터 모델, 엔지니어링 로그를 한국어로 갱신하고 기능 단위 커밋과 검증 결과를 남긴다.

## 작업 순서

### 슬라이스 1 — 자금통 Domain과 집계 계약

- 기본 자금통·표현·ID 검증을 추가한다.
- Transaction과 런타임 검증, 자금통별 지출 집계 테스트를 만든다.

### 슬라이스 2 — 저장소 마이그레이션과 Import 기본값

- IndexedDB를 v6으로 올리고 기존 일반 지출에 `LIVING`을 안전하게 추가한다.
- 새 Import `EXPENSE` 후보의 기본 자금통 표시를 보존한다.

### 슬라이스 3 — 거래 편집과 최소 Dashboard 연결

- 거래 수정 Bottom Sheet에 자금통 선택을 추가한다.
- Home에 자금통별 지출 요약을 연결하고 기존 생활비는 `LIVING`만 집계한다.

### 슬라이스 4 — 문서화와 전체 검증

- 요구사항·이력·ADR·architecture·data model·계획·로그를 갱신한다.
- lint, typecheck, test, build, 공백 검사 결과를 남기고 상태를 `DONE`으로 바꾼다.

## 검증 결과

| 검증 항목 | 결과 | 비고 |
| --- | --- | --- |
| Domain·집계 테스트 | 대기 | 구현 후 실행 |
| IndexedDB v6 마이그레이션 | 대기 | 구현 후 실행 |
| Import·거래 편집·Home UI 테스트 | 대기 | 구현 후 실행 |
| lint·typecheck·test·build | 대기 | 구현 후 실행 |
