# 데이터 모델

> 상태: 10B단계 구현 기준선
>
> 기준일: 2026-08-10

## 설계 목적

금융기관마다 다른 원본 표현을 가계부 로직에 직접 사용하지 않는다. 모든 지원 형식은 공통 Transaction 후보로 정규화하고, 저장 전 검증한다. 이 문서는 최소 모델과 후속 단계에서 추가할 필드를 구분한다. 구현은 `src/domain/transactions/`, `src/domain/budget-buckets/`에 있으며 React, 파일 Parser, 저장소와 독립적이다.

## 거래 최소 모델

| 필드 | 타입 개념 | 필수 | 선택 이유 |
| --- | --- | --- | --- |
| `id` | UUID 문자열 | 예 | 원본 기관 식별자와 분리된 앱 내부 식별자 |
| `occurredOn` | `YYYY-MM-DD` CalendarDate | 예 | 대부분의 소비·월간 집계에 필요한 실제 거래일 |
| `amountMinor` | 양의 safe integer | 예 | KRW 원 단위 계산에서 부동소수점 오류 방지 |
| `currency` | 초기에는 `'KRW'` | 예 | 금액 해석을 명시하고 다중 통화의 암묵적 혼합 방지 |
| `direction` | `INFLOW \| OUTFLOW` | 예 | 금액 부호와 유입·유출 의미를 분리 |
| `type` | `TransactionType` | 예 | 소비, 이체, 저축 등을 분리 집계 |
| `budgetBucketId` | 공백 없는 1–80자 문자열 `BudgetBucketId` | 예 | 카테고리와 독립된 자금 목적을 지정하고 향후 사용자 정의 ID를 허용 |
| `descriptionOriginal` | 문자열 | 예 | 급여·이체를 포함한 원본 거래 설명을 의미 왜곡 없이 보존 |
| `merchantOriginal` | 문자열 | 아니요 | 원본에 상호 또는 거래 상대가 별도로 있을 때 보존 |
| `merchantNormalized` | 문자열 | 아니요 | 검색·규칙·중복 후보에 쓸 정규화 값 |
| `paymentInstrumentLabel` | 문자열 | 아니요 | 전체 계좌·카드 번호 없이 사용 수단을 구분 |
| `memo` | 문자열 | 아니요 | 사용자가 남기는 추가 설명 |
| `createdAt` | UTC ISO instant | 예 | 로컬 레코드 생성 시점 추적 |
| `updatedAt` | UTC ISO instant | 예 | 사용자 수정 시점 추적 |

### 거래 유형

```text
EXPENSE
INCOME
TRANSFER
SELF_TRANSFER
CARD_PAYMENT
SAVING
INVESTMENT
LOAN_PAYMENT
REWARD
REFUND
UNKNOWN
```

## 자금통(`BudgetBucket`)

`BudgetBucket`은 사용자 화면에서 **자금통**으로 표시하는 별도 Domain 모델이다. 지출 카테고리가 무엇에 사용했는지를 나타내는 것과 달리, 자금통은 어느 목적의 돈으로 관리하는지를 나타낸다. `BudgetBucketId`는 고정 열거형이 아니라 공백 없는 문자열이므로 이후 사용자가 만든 자금통 ID도 Transaction과 정산에서 보존할 수 있다.

| 필드 | 타입 개념 | 필수 | 의미 |
| --- | --- | --- | --- |
| `id` | `BudgetBucketId` | 예 | 자금통의 안정적인 식별자 |
| `name` | 1–40자 텍스트 | 예 | 화면에 보이는 이름 |
| `icon` | 1–16자 텍스트 | 예 | 로컬 화면에서 쓰는 대표 아이콘 |
| `order` | 0 이상 safe integer | 예 | 목록 표시 순서 |
| `isDefault` | boolean | 예 | 초기 제공 자금통 여부 |
| `isArchived` | boolean | 예 | 사용자 목적이 새 선택지에서 제외되어야 하는지 나타냄 |

IndexedDB v6은 `LIVING`(생활비), `IRREGULAR`(비정기비), `EMERGENCY`(비상금), `SAVING`(저축), `HOUSING_MARRIAGE`(주거·결혼), `INVESTMENT`(투자), `OTHER`(기타) 7개를 초기 저장한다. v7은 기존 목적에 `isArchived: false`를 안전하게 추가한다. Settings에서는 사용자 목적 추가·이름/아이콘 수정·보관을 지원한다. 기본 목적은 보관할 수 없고, 보관된 목적은 기존 거래에 남아 있지만 새 거래 선택지에서는 제외한다. 자금통별 월 목표는 제공하지 않는다.

### 불변식

- `amountMinor`는 0보다 큰 `Number.isSafeInteger` 범위 값이다.
- 부호가 있는 금액과 `direction`을 함께 사용하지 않는다. 원본 부호는 Adapter가 `amountMinor`와 `direction`으로 분해한다.
- `direction`은 자금 방향이고 `type`은 경제적 의미다. Dashboard 집계는 방향만으로 판단하지 않는다.
- 자금통별 지출은 `type === 'EXPENSE'`, `direction === 'OUTFLOW'`, 지정한 `budgetBucketId`가 모두 일치하는 거래만 포함한다. 따라서 `CARD_PAYMENT`, `TRANSFER`, `UNKNOWN`을 포함한 나머지 유형과 유입 거래는 제외한다.
- 생활비는 자금통별 지출 중 `budgetBucketId === 'LIVING'`인 값만 뜻한다. 전체 소비는 모든 자금통의 `EXPENSE + OUTFLOW`를 합산하므로 생활비와 같은 값이라고 가정하지 않는다.
- `budgetBucketId`는 모든 Transaction의 필수 값이며 공백 없이 1자 이상 80자 이하인 문자열이어야 한다. 런타임 검증은 현재 기본 목록에 없는 ID도 거부하지 않아 이후 사용자 정의 자금통을 막지 않는다.
- `SAVING`, `INVESTMENT`, `LOAN_PAYMENT`는 생활비와 별도 집계한다. 대출 원금·이자 분리는 실제 데이터 요구가 생길 때 결정한다.
- `REFUND`의 원거래 연결과 귀속 월은 Phase 6 전에 결정한다.
- `UNKNOWN`도 유효한 임시 값이지만 Preview에서 확인 필요 대상으로 표시한다.
- `SELF_TRANSFER`는 사용자가 관리하는 본인 계좌 별칭이 있어야 판별한다. Phase 6B의 계좌 Importer는 이 값을 자동 추론하지 않는다.
- 계좌 유형 분류의 `source`, `reasonCode`, `confidence`는 확정 전 `ImportCandidate` 메타데이터다. 확정 Transaction에는 검증된 `type`만 저장한다.
- `descriptionOriginal`과 `merchantOriginal`은 사용자 수정으로 덮어쓰지 않고, 정제 결과는 별도 필드에 둔다.

## 런타임 검증 계약

- `validateTransaction(unknown)`은 성공 시 허용된 필드만으로 새 Transaction 객체를 만들고, 실패 시 throw하지 않고 발견한 모든 문제를 반환한다.
- 입력 루트는 일반 객체만 허용한다. 배열, `Date`, `Map`, 클래스 인스턴스와 예상하지 않은 필드는 거부한다.
- 오류에는 원본 값, 예상하지 않은 필드명, 전체 금융 식별정보를 포함하지 않는다.
- `id`는 nil이 아닌 표준 8-4-4-4-12 UUID 문자열이다. UUID 버전과 저장소 수준 유일성은 아직 검증 범위가 아니다.
- `CalendarDate`는 `0001-01-01`부터 `9999-12-31`까지 실제 달력에 존재하는, 0으로 채운 `YYYY-MM-DD`만 허용한다.
- `createdAt`과 `updatedAt`은 `Z`로 끝나는 UTC instant다. 초 소수부는 없거나 1~3자리만 허용하며 `updatedAt >= createdAt`이어야 한다.
- 필수·선택 문자열은 공백만으로 구성할 수 없다. 검증된 원문은 임의로 trim하거나 정규화하지 않는다.
- `paymentInstrumentLabel`은 별칭이나 끝 4자리 같은 비민감 라벨만 허용한다. ASCII 숫자가 4개를 초과하면 전체 카드·계좌번호 가능성이 있다고 보고 거부한다.

## 날짜와 시간

- 거래 파일이 날짜만 제공하면 `occurredOn`을 CalendarDate 문자열로 보존한다.
- `new Date('YYYY-MM-DD')`로 날짜 전용 값을 변환하지 않는다. UTC 변환으로 날짜가 달라질 수 있기 때문이다.
- 실제 시각이 필요한 파일이 확인되면 `occurredAt`을 별도 instant 또는 local date-time으로 추가할지 결정한다.
- 승인일과 게시일이 다른 실제 사례가 확인되면 `postedOn`을 선택 필드로 추가한다.
- `createdAt`과 `updatedAt`처럼 앱이 생성하는 시각은 UTC ISO 8601 instant로 저장하고 UI에서 `Asia/Seoul`로 표시한다.
- 현재 `최근 1주`는 선택일과 앞선 6일의 rolling range다. 주 시작 요일을 따르는 별도 정책은 실제 요구가 생길 때 결정한다.

## 단계별 확장

### 3단계 — Legacy XLS 가져오기

계좌 거래·카드 이용 Legacy XLS를 Preview하고 사용자가 확정할 때 Transaction에 다음 출처 필드를 추가한다.

| 필드 | 목적 |
| --- | --- |
| `importBatchId` | 어떤 확정 Import에서 생성되었는지 추적 |
| `importerId` | 어떤 Adapter와 형식이 정규화했는지 추적 |
| `sourceRecordId` | 원본이 제공하는 비밀이 아닌 안정적 식별자가 있을 때만 보존 |

`sourceRecordId`에 계좌번호, 전체 카드번호, 주민등록번호를 대신 넣지 않는다.

### 4단계 — 중복 후보 검토

- `fingerprint`
- `fingerprintVersion`

fingerprint는 후보 검색을 돕는 값이다. 날짜·금액·거래 유형·정규화 Merchant·결제수단 등 여러 신호와 사용자 확인을 함께 사용하며, 단일 해시 일치만으로 거래를 삭제하지 않는다. 구성과 버전 관리는 4단계 ADR 또는 설계 문서에서 확정한다.

> **구현 결정(2026-08-05):** 4단계는 v1 fingerprint와 정규화 설명을 `Transaction` 또는 IndexedDB에 추가하지 않고 메모리에만 둔다. `occurredOn`, `amountMinor`, `currency`, `direction`, `type`, 정규화한 `descriptionOriginal`을 비교하며 `paymentInstrumentLabel`은 제외한다. 정확한 계약은 [중복 후보 검토](duplicate-candidate-review.md)와 [ADR-0006](../adr/ADR-0006-duplicate-candidates-require-user-confirmation.md)를 따른다.

### 5단계 — 카테고리 규칙

- `categoryId`

Category와 CategoryRule은 실제 규칙 사용 사례가 생긴 뒤 별도 모델로 정의한다. 처음 보는 Merchant에 대한 사용자 확인과 규칙 생성 동의를 구분한다.

> **구현 결정(2026-08-05):** `Transaction.categoryId`는 선택 값이고 `categoryRules`는 IndexedDB v2의 별도 저장소다. 현재 Importer는 신뢰할 수 있는 별도 가맹점 필드를 제공하지 않으므로 정규화한 `descriptionOriginal`의 정확 일치 키를 사용한다. 규칙은 새 Preview의 카테고리만 채우며 생성·교체에는 명시적 동의가 필요하다. 자세한 내용은 [사용자 확인형 카테고리 규칙 계약](category-rule-contract.md)과 [ADR-0007](../adr/ADR-0007-confirmed-description-category-rules.md)를 따른다.

### 8B단계 — 로컬 월 생활비 목표

`LocalUserSettings`는 `Transaction` 필드가 아닌 별도 단일 레코드다. 현재 값은 양의 KRW safe integer 월 생활비 목표와 UTC 갱신 시각뿐이다. IndexedDB v3부터 고정 키 `current`에 저장하며, 레코드를 제거하면 목표가 없는 상태를 뜻한다.

장부는 이 목표를 달력 월의 `LIVING` 자금통 순지출과만 비교한다. Import 거래를 바꾸거나 급여 계산기 값을 저장하지 않으며, 하루·주·직접 선택 기간의 예산을 추정하지 않는다. 자세한 내용은 [ADR-0011](../adr/ADR-0011-local-monthly-living-expense-goal.md)을 따른다.

### 8C단계 — 가맹점 해석 메타데이터

Phase 8C는 Transaction 또는 IndexedDB 스키마를 변경하지 않는다. 현재 카드 XLS가 별도 Merchant 필드를 제공하지 않으므로 Preview의 `descriptionOriginal`을 Merchant 해석 입력으로만 사용하며, `merchantOriginal`과 `merchantNormalized`를 새로 채우지 않는다.

정규화 표시값·comparison key, Alias/Fuzzy 출처, canonical query, Kakao 검색 시도, 장소·카테고리와 Review 이유는 모두 Import Preview 메모리에만 존재한다. 확정 저장에는 사용자가 확인한 기존 `Transaction.categoryId`만 남고 Merchant resolution trace나 Kakao DTO는 포함하지 않는다. 자세한 경계는 [Merchant Resolution Contract](merchant-resolution-contract.md)와 [ADR-0012](../adr/ADR-0012-merchant-entity-resolution-before-vector-search.md)를 따른다.

### 10A단계 — 다대다 공동결제 정산

`BudgetSettlement`는 원본 `Transaction`을 수정하지 않고 여러 지출과 여러 정산 입금을 하나의 정산 묶음으로 표현한다. `outflowTransactionIds`와 `inflowTransactionIds`는 모두 하나 이상의 고유 UUID이며, 같은 거래가 두 배열에 동시에 있거나 다른 정산에 다시 연결되면 저장하지 않는다. 10B부터 정산은 필수 `budgetBucketId` 하나를 가진다. 선택 기간의 연결 지출 합계에서 연결 입금 전체를 빼고 0 이상으로 제한한 순지출은 이 자금통에만 귀속한다. 여러 자금통 자동 분할은 제공하지 않는다. 기존 v4·v5 저장 레코드는 IndexedDB v6에서 배열과 `LIVING` 자금통을 갖는 모델로 변환한다. 자세한 저장 계약은 [로컬 거래 저장 계약](local-transaction-storage.md), 결정은 [ADR-0014](../adr/ADR-0014-many-to-many-shared-payment-settlements.md), [ADR-0015](../adr/ADR-0015-separate-expense-category-and-budget-bucket.md)를 따른다.

### 10B단계 — 거래별 자금통

모든 Transaction은 하나의 필수 `budgetBucketId`를 저장하고, `budgetBuckets` 저장소는 기본 자금통 7개와 향후 사용자 정의 자금통 레코드를 담는다. v6 업그레이드는 자금통이 없는 기존 Transaction과 정산에 `LIVING`을 넣는다. 이 값은 데이터 손실을 막기 위한 기존 데이터용 기본값이며 과거 목적을 확정하지 않는다.

카테고리 규칙과 Kakao 분류는 카테고리만 제안하며 자금통을 자동으로 바꾸지 않는다. Import Preview는 `LIVING` 기본값을 보여 주고, 확정 뒤 거래 편집 화면에서 자금통을 바꾼다. `calculateBudgetBucketExpenseSummary`는 자금통별 `EXPENSE + OUTFLOW`와 해당 자금통에 명시적으로 귀속한 공동결제 순지출을 계산한다. 기존 `calculateLivingExpenseSummary`는 `LIVING` 요약을 반환해 월 목표와 주간 그래프의 기준을 유지한다.

### 로컬 장부 백업 JSON

`LocalLedgerBackup`은 `ALL_D_DEAL_LOCAL_LEDGER` 식별자, 정수 버전, UTC `exportedAt`, 모든 로컬 저장소를 담은 `data`로 구성된다. 현재 버전은 거래, Import 이력, 공동결제 정산, 정확·키워드 카테고리 규칙, 월 생활비 설정, 돈의 목적, 사용자 카테고리와 거래 이미지 첨부를 포함한다. 원본 Import 파일·원본 행·Preview 후보/분석 trace·급여 입력/결과·외부 서비스 응답은 포함하지 않는다.

백업 파일은 신뢰할 수 없는 입력으로 취급한다. 복원 전에 루트와 레코드 모양, 포맷 버전, 중복 키, Import Batch·카테고리·돈의 목적·정산 참여 거래·첨부 참조를 모두 검증한다. 한 거래는 하나의 공동결제 정산에만 참여할 수 있다. UI에서 사용자가 별도로 확인한 뒤 모든 저장소를 하나의 IndexedDB 읽기·쓰기 트랜잭션으로 교체한다. 트랜잭션 실패는 전체를 되돌려 기존 장부를 보존한다. 구체 형식과 범위는 [ADR-0017](../adr/ADR-0017-versioned-local-ledger-backup.md)을 따른다.

## ImportBatch 후보

확정된 Import 작업을 추적하기 위한 최소 후보는 다음과 같다.

| 필드 | 목적 |
| --- | --- |
| `id` | Batch 식별자 |
| `importerId` | 사용한 Adapter 종류 |
| `importerVersion` | 정규화 규칙 변경 추적 |
| `sourceType` | `GENERIC_TEST_CSV` 등 입력 종류 |
| `fileDigest` | 동일 파일 재선택 경고용 선택 값 |
| `committedAt` | 확정 저장한 UTC 시각 |
| `newCount` | 신규 저장 건수 |
| `skippedCount` | 중복 또는 사용자 제외 건수 |
| `reviewedCount` | 확인 후 확정한 건수 |

원본 파일명과 Blob은 저장하지 않는다. `fileDigest`는 동일 파일 경고에만 사용하며 개별 거래의 중복을 확정하지 않는다. 구체 필드는 Phase 3 계획에서 다시 최소화한다.

## 저장하지 않는 데이터

- 원본 PDF, CSV, XLSX 파일과 전체 원본 행
- 금융기관 ID와 비밀번호
- 주민등록번호와 공동인증서
- 전체 계좌번호와 카드번호
- Parser가 사용하는 기관별 Source Record
- 확정 전 ImportCandidate와 Preview 상태
- Merchant resolution trace, Kakao 검색 시도와 장소 응답

Source Record와 ImportCandidate는 처리 중 메모리에만 두고 확정된 Domain 데이터만 저장한다.

## 3단계 저장 경계 결정

Phase 2에서는 저장 포트, DB 스키마와 라이브러리를 구현하지 않는다. Phase 3의 `confirmImport`에서 `ImportBatch + Transaction[]` 원자 저장과 날짜 조회가 실제로 필요해질 때 Native IndexedDB를 기본값으로 도입한다.

복합 쿼리, 페이지네이션, 반응형 조회 또는 여러 버전의 스키마 마이그레이션이 필요해지면 Dexie를 다시 비교한다. 판단 근거는 [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [MDN IndexedDB 사용 안내](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [Dexie transaction](https://dexie.org/docs/Dexie/Dexie.transaction()), [Dexie schema upgrade](https://dexie.org/docs/Version/Version.upgrade()) 문서다.

## 후속 모델

다음은 방향만 기록하며 현재 구현하거나 빈 인터페이스를 만들지 않는다.

- 주간 목표, 기간 비례 예산, 저축액과 월 저축 가능액: 별도 요구 확인 후
- 주거·결혼자금, 비상금, 청약, 투자, 대출: 자금통별 목표·자산 모델 요구가 확인된 뒤
- 사용자 정의 자금통의 재활성화·순서 변경, 자금통별 월 목표, 수입 배분과 `TransactionAllocation[]`: 별도 요구 확인 후
- 환불 원거래 연결, 분할 거래, 다중 통화: 실제 요구 확인 후

## 미결정 사항

- 실제 금융 파일에 시각과 게시일이 얼마나 제공되는지
- `REFUND`의 원거래 연결 방식과 월간 집계 기준
- `LOAN_PAYMENT`의 원금·이자 분리 방식
- 영속 Merchant identity·사용자 Alias·성공 Cache를 도입할지와 삭제·보존 정책
- ImportBatch 통계 필드를 저장할지 조회 시 계산할지
- 다중 통화 도입 시 환율과 반올림 정책
