# Data Model

> 상태: Phase 2 Implemented Baseline
>
> 기준일: 2026-08-05

## 설계 목적

금융기관마다 다른 원본 표현을 가계부 로직에 직접 사용하지 않는다. 모든 지원 형식은 공통 Transaction 후보로 정규화하고, 저장 전 검증한다. 이 문서는 Phase 2에서 구현한 최소 모델과 후속 Phase에서 추가할 필드를 구분한다. 구현은 `src/domain/transactions/`에 있으며 React, 파일 Parser, 저장소와 독립적이다.

## Transaction MVP

| 필드 | 타입 개념 | 필수 | 선택 이유 |
| --- | --- | --- | --- |
| `id` | UUID 문자열 | 예 | 원본 기관 식별자와 분리된 앱 내부 식별자 |
| `occurredOn` | `YYYY-MM-DD` CalendarDate | 예 | 대부분의 소비·월간 집계에 필요한 실제 거래일 |
| `amountMinor` | 양의 safe integer | 예 | KRW 원 단위 계산에서 부동소수점 오류 방지 |
| `currency` | 초기에는 `'KRW'` | 예 | 금액 해석을 명시하고 다중 통화의 암묵적 혼합 방지 |
| `direction` | `INFLOW \| OUTFLOW` | 예 | 금액 부호와 유입·유출 의미를 분리 |
| `type` | `TransactionType` | 예 | 소비, 이체, 저축 등을 분리 집계 |
| `descriptionOriginal` | 문자열 | 예 | 급여·이체를 포함한 원본 거래 설명을 의미 왜곡 없이 보존 |
| `merchantOriginal` | 문자열 | 아니요 | 원본에 상호 또는 거래 상대가 별도로 있을 때 보존 |
| `merchantNormalized` | 문자열 | 아니요 | 검색·규칙·중복 후보에 쓸 정규화 값 |
| `paymentInstrumentLabel` | 문자열 | 아니요 | 전체 계좌·카드 번호 없이 사용 수단을 구분 |
| `memo` | 문자열 | 아니요 | 사용자가 남기는 추가 설명 |
| `createdAt` | UTC ISO instant | 예 | 로컬 레코드 생성 시점 추적 |
| `updatedAt` | UTC ISO instant | 예 | 사용자 수정 시점 추적 |

### TransactionType

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

### 불변식

- `amountMinor`는 0보다 큰 `Number.isSafeInteger` 범위 값이다.
- 부호가 있는 금액과 `direction`을 함께 사용하지 않는다. 원본 부호는 Adapter가 `amountMinor`와 `direction`으로 분해한다.
- `direction`은 자금 방향이고 `type`은 경제적 의미다. Dashboard 집계는 방향만으로 판단하지 않는다.
- 생활비는 `type === 'EXPENSE'`이면서 `direction === 'OUTFLOW'`인 거래만 포함한다. 따라서 `CARD_PAYMENT`, `TRANSFER`, `UNKNOWN`을 포함한 나머지 유형과 유입 거래는 제외한다.
- `SAVING`, `INVESTMENT`, `LOAN_PAYMENT`는 생활비와 별도 집계한다. 대출 원금·이자 분리는 실제 데이터 요구가 생길 때 결정한다.
- `REFUND`의 원거래 연결과 귀속 월은 Phase 6 전에 결정한다.
- `UNKNOWN`도 유효한 임시 값이지만 Preview에서 확인 필요 대상으로 표시한다.
- `SELF_TRANSFER`는 사용자가 관리하는 본인 계좌 별칭이 있어야 판별한다. Phase 6B의 계좌 Importer는 이 값을 자동 추론하지 않는다.
- 계좌 유형 분류의 `source`, `reasonCode`, `confidence`는 확정 전 `ImportCandidate` 메타데이터다. 확정 Transaction에는 검증된 `type`만 저장한다.
- `descriptionOriginal`과 `merchantOriginal`은 사용자 수정으로 덮어쓰지 않고, 정제 결과는 별도 필드에 둔다.

## Phase 2 런타임 검증 계약

- `validateTransaction(unknown)`은 성공 시 허용된 필드만으로 새 Transaction 객체를 만들고, 실패 시 throw하지 않고 발견한 모든 issue를 반환한다.
- 입력 루트는 plain object만 허용한다. 배열, `Date`, `Map`, 클래스 인스턴스와 예상하지 않은 필드는 거부한다.
- 오류에는 원본 값, 예상하지 않은 필드명, 전체 금융 식별정보를 포함하지 않는다.
- `id`는 nil이 아닌 canonical 8-4-4-4-12 UUID 문자열이다. UUID 버전과 저장소 수준 유일성은 아직 검증 범위가 아니다.
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
- 주간 집계 시작 요일은 Phase 6에서 사용자의 선호를 확인하거나 Settings 기본값으로 결정한다.

## Phase별 확장

### Phase 3 — Legacy XLS Import

계좌 거래·카드 이용 legacy XLS를 Preview하고 사용자가 확정할 때 Transaction에 다음 출처 필드를 추가한다.

| 필드 | 목적 |
| --- | --- |
| `importBatchId` | 어떤 확정 Import에서 생성되었는지 추적 |
| `importerId` | 어떤 Adapter와 형식이 정규화했는지 추적 |
| `sourceRecordId` | 원본이 제공하는 비밀이 아닌 안정적 식별자가 있을 때만 보존 |

`sourceRecordId`에 계좌번호, 전체 카드번호, 주민등록번호를 대신 넣지 않는다.

### Phase 4 — Duplicate Detection

- `fingerprint`
- `fingerprintVersion`

fingerprint는 후보 검색을 돕는 값이다. 날짜·금액·거래 유형·정규화 Merchant·결제수단 등 여러 신호와 사용자 확인을 함께 사용하며, 단일 해시 일치만으로 거래를 삭제하지 않는다. 구성과 versioning은 Phase 4 ADR 또는 설계 문서에서 확정한다.

> **Implemented decision (2026-08-05):** Phase 4 keeps the v1 fingerprint and normalized description in memory only, rather than adding either field to `Transaction` or IndexedDB. It compares `occurredOn`, `amountMinor`, `currency`, `direction`, `type`, and normalized `descriptionOriginal`; `paymentInstrumentLabel` is excluded. The exact contract is [Duplicate Candidate Review](duplicate-candidate-review.md) and [ADR-0006](../adr/ADR-0006-duplicate-candidates-require-user-confirmation.md).

### Phase 5 — Category Rule

- `categoryId`

Category와 CategoryRule은 실제 규칙 사용 사례가 생긴 뒤 별도 모델로 정의한다. 처음 보는 Merchant에 대한 사용자 확인과 규칙 생성 동의를 구분한다.

> **Implemented decision (2026-08-05):** `Transaction.categoryId` is optional and `categoryRules` is a separate IndexedDB v2 store. The current importers use an exact normalized `descriptionOriginal` key because they do not provide a reliable merchant field. Rules only fill a new Preview and require explicit consent to create or replace. See [Confirmed Category Rule Contract](category-rule-contract.md) and [ADR-0007](../adr/ADR-0007-confirmed-description-category-rules.md).

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

Source Record와 ImportCandidate는 처리 중 메모리에만 두고 확정된 Domain 데이터만 저장한다.

## Phase 3 저장 경계 결정

Phase 2에서는 저장 포트, DB 스키마와 라이브러리를 구현하지 않는다. Phase 3의 `confirmImport`에서 `ImportBatch + Transaction[]` 원자 저장과 날짜 조회가 실제로 필요해질 때 Native IndexedDB를 기본값으로 도입한다.

복합 쿼리, 페이지네이션, 반응형 조회 또는 여러 버전의 스키마 마이그레이션이 필요해지면 Dexie를 다시 비교한다. 판단 근거는 [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [MDN IndexedDB 사용 안내](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [Dexie transaction](https://dexie.org/docs/Dexie/Dexie.transaction()), [Dexie schema upgrade](https://dexie.org/docs/Version/Version.upgrade()) 문서다.

## 후속 모델

다음은 방향만 기록하며 현재 구현하거나 빈 인터페이스를 만들지 않는다.

- 생활비 목표와 사용자 Settings: Phase 6 또는 별도 계획
- 주거·결혼자금, 비상금, 청약, 투자, 대출: Phase 8
- 환불 원거래 연결, 분할 거래, 다중 통화: 실제 요구 확인 후

## 미결정 사항

- 실제 금융 파일에 시각과 게시일이 얼마나 제공되는지
- `REFUND`의 원거래 연결 방식과 월간 집계 기준
- `LOAN_PAYMENT`의 원금·이자 분리 방식
- Merchant 정규화 규칙과 결제수단 라벨의 가명 처리
- ImportBatch 통계 필드를 저장할지 조회 시 계산할지
- 다중 통화 도입 시 환율과 반올림 정책
