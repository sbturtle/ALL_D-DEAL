# 로컬 거래 저장 계약

> 상태: 10B단계 구현 중
>
> 갱신일: 2026-08-10

## 브라우저 데이터베이스

브라우저는 네이티브 IndexedDB 데이터베이스 `household-ledger`를 사용하며, 현재 스키마 버전은 `6`이다.

| 저장소 | 키 | 인덱스 | 저장 목적 |
| --- | --- | --- | --- |
| `transactions` | `id` | `occurredOn`, `importBatchId` | 확정된 정규화 거래만 저장 |
| `importBatches` | `id` | `committedAt` | Import 출처와 건수 저장 |
| `budgetSettlements` | `id` | `outflowTransactionIds` | 명시적인 다대다 공동결제 연결 |
| `categoryRules` | `matchDescriptionNormalized` | — | 이후 Import Preview에 재사용할 사용자 확인 카테고리 |
| `keywordCategoryRules` | `keywordNormalized` | — | Review 묶기와 이후 Import Preview에 재사용할 사용자 확인 포함 키워드 |
| `userSettings` | `id` (`current`) | — | 로컬 월 생활비 목표와 갱신 시각 하나 |
| `budgetBuckets` | `id` | `order` | 기본·향후 사용자 정의 자금통의 이름, 아이콘, 표시 순서, 상태 |

원본 XLS blob, 원본 파일명, Parser 행 배열, Preview 상태, 전체 계좌·카드 번호와 금융기관 식별자는 저장하지 않는다.

## 원자적 Import 확정

`confirmLegacyXlsImport`는 유효한 Preview 후보를 완전하고 검증된 `Transaction` 레코드로 변환한다. 각 레코드에는 생성한 UUID, 하나의 `ImportBatch` UUID, `LEGACY_XLS` importer ID, `LIVING` 기본 `budgetBucketId`, UTC 생성·갱신 시각이 들어간다.

저장소는 하나의 IndexedDB read-write transaction으로 `ImportBatch`와 모든 거래를 기록한다. 하나라도 추가에 실패하면 전체 작업을 중단해 Batch나 일부 거래만 남지 않는다. UI에는 일반화된 실패 결과만 전달하며 원본 데이터는 노출하지 않는다.

## 기간 조회

`occurredOn`은 날짜 전용 `YYYY-MM-DD` 문자열이다. `transactions.occurredOn` 인덱스를 양끝 포함 범위로 조회하고 최신순으로 정렬한다.

| 컨트롤 | 조회 범위 |
| --- | --- |
| 하루 | 선택한 날짜만 |
| 최근 1주 | 선택한 날짜와 이전 6일 |
| 이번 달 | 선택한 날짜가 속한 달의 첫날부터 마지막 날 |
| 직접 선택 | 선택한 시작일과 종료일, 양끝 포함 |

기준일과 표시 의미는 `Asia/Seoul`을 사용하며 날짜 전용 값을 UTC timestamp로 변환하지 않는다.

## 공동결제 정산

`BudgetSettlement`는 `OUTFLOW` 지출 ID 배열 `outflowTransactionIds`, `INFLOW` 정산금 ID 배열 `inflowTransactionIds`, 하나의 필수 `budgetBucketId`를 저장한다. 두 배열은 각각 하나 이상이며, 저장 유스케이스는 참가자 존재 여부, 방향, 배열 중복·교차, 다른 정산과의 중복 연결과 자금통 ID를 검증한다.

선택 기간에는 일반 `EXPENSE + OUTFLOW`를 자금통별로 더하고, 정산에 연결된 지출 중 해당 기간의 금액 합계에서 연결 입금 전체를 차감한 `max(지출 합계 - 입금 합계, 0)`을 정산의 `budgetBucketId` 하나에만 반영한다. 입금이 이후 날짜여도 선택한 지출 기간에 귀속한다. 여러 자금통에 정산금을 자동 분할하지 않으며, 원본 거래와 일반 입출금 합계는 변경하지 않는다. 자세한 결정은 [ADR-0014](../adr/ADR-0014-many-to-many-shared-payment-settlements.md), [ADR-0015](../adr/ADR-0015-separate-expense-category-and-budget-bucket.md)를 따른다.

## 자금통과 v6 마이그레이션

`budgetBuckets`는 `id`를 키로 하고 `order` 인덱스를 가진다. 레코드는 `id`, `name`, `icon`, `order`, `isDefault`, `isArchived`를 모두 검증한다. v6 업그레이드는 자금통이 없는 기존 모든 Transaction과 공동결제 정산에 `LIVING`을 넣고, 기본 자금통 `LIVING`, `IRREGULAR`, `EMERGENCY`, `SAVING`, `HOUSING_MARRIAGE`, `INVESTMENT`, `OTHER` 7개를 seed한다. 이 마이그레이션은 과거 거래의 실제 목적을 추정하지 않고 레코드 손실을 막는 legacy 기본값만 제공한다.

새 Transaction과 정산은 하나의 `budgetBucketId`를 반드시 저장한다. ID 검증은 공백 없는 문자열을 허용하고 기본 7개로 닫지 않으므로 이후 사용자 정의 자금통을 저장할 수 있다. 현재는 생성·이름 변경·보관 UI와 자금통별 목표를 제공하지 않는다.

## 로컬 월 생활비 목표

`userSettings`는 `current`를 키로 하는 단일 레코드다. 양의 KRW safe integer `monthlyLivingExpenseGoalMinor`와 UTC `updatedAt`만 담는다. 저장은 해당 레코드를 교체하고 비우기는 삭제한다. 기본 금액은 저장하거나 추정하지 않는다.

저장 장부는 달력 월 보기에서만 목표를 읽는다. `calculateLivingExpenseSummary`가 반환하는 `LIVING` 자금통 순지출과 비교하므로 연결된 공동결제는 사용자가 정한 `LIVING` 정산일 때만 순지출로 기여한다. 하루·주·직접 선택 범위에는 목표를 임의로 배분하지 않고 실제 사용액만 보여 준다. 급여 계산기 입력과 결과는 이 저장소에 들어가지 않는다. 자세한 결정은 [ADR-0011](../adr/ADR-0011-local-monthly-living-expense-goal.md)을 따른다.

## 확인형 로컬 장부 초기화

`resetLocalLedger`는 일곱 저장소를 대상으로 하나의 읽기·쓰기 트랜잭션을 연다. 거래, Import 이력, 정산, 정확·키워드 카테고리 규칙, 로컬 설정, 기존 사용자 자금통을 비운 뒤, 같은 트랜잭션 안에서 기본 자금통 7개를 `budgetBuckets`에 다시 저장한다. 스키마, 데이터베이스 이름, 브라우저 origin, 원본 파일과 애플리케이션 설정은 유지한다. 중단이나 요청 오류가 나면 작업을 거부하므로 UI는 확인 dialog를 열어 둔 채 성공을 알리지 않는다.

Settings 컨트롤은 이 작업을 호출하기 전에 접근 가능한 확인 dialog를 연다. dialog에는 영향을 받는 일곱 데이터 그룹과 사용자 정의 자금통은 삭제되지만 기본 자금통 7개는 즉시 다시 만들어진다는 안내, 원본 Excel·샘플·앱 코드·환경 설정은 대상이 아니라는 안내를 표시한다. 배경 닫기·Escape·취소는 저장소 작업을 호출하지 않는다. 자세한 결정은 [ADR-0013](../adr/ADR-0013-confirmed-local-ledger-reset.md)을 따른다.
