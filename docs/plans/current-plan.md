# Phase 2 — Transaction Domain Foundation

- 상태: `IN_PROGRESS`
- 계획일: 2026-08-05
- 시작일: 2026-08-05

## Goal

금융기관별 원본 표현과 저장 기술에서 독립된 최소 Transaction Domain을 구현하고, 이후 Import·중복 탐지·Dashboard 집계가 공유할 금액·날짜·거래 유형 불변식을 자동 테스트로 고정한다.

Phase 2는 급여 추정 결과를 Transaction으로 바꾸거나 실제 금융 파일을 읽지 않는다. 저장 경계는 실제 Domain 사용 사례가 요구하는 최소 수준에서 Native IndexedDB와 Dexie를 비교한 뒤 결정한다.

## User Value

- 수입·지출·이체·카드대금·저축 등 서로 다른 금융 활동을 일관된 의미로 다룰 기반을 얻는다.
- 카드 사용과 카드대금 납부가 생활비로 중복 집계되는 오류를 Domain 단계에서 예방한다.
- 이후 파일 Import가 특정 UI나 금융기관 형식에 결합되지 않도록 공통 수용 경계를 갖는다.

## Current State

- Phase 1 React 앱, 자동 검증과 메모리 전용 급여 실수령 추정기가 완료되었다.
- `docs/architecture/data-model.md`에 Transaction MVP 필드와 불변식이 설계 기준선으로 존재한다.
- 공통 Transaction 런타임 타입, 검증 함수, 저장 포트와 IndexedDB 구현은 아직 없다.
- 실제 금융 데이터, 실제 금융기관 fixture와 Import Parser는 없다.

## Implementation Contract

- 새 검증 라이브러리 없이 작은 TypeScript type guard와 순수 함수로 구현한다.
- `unknown` 후보는 예상 가능한 오류를 throw하지 않고 필드별 issue를 모두 수집한다. issue에는 거부된 원문 값과 전체 후보를 넣지 않는다.
- 반환 Transaction은 허용 필드만 새 객체로 구성하며 추가 키는 오류로 보고해 원본 행이나 Phase 3 메타데이터의 우발적 저장을 막는다.
- `CalendarDate`는 `0001-01-01`부터 `9999-12-31`까지의 실제 달력 날짜로 검증하고 날짜 전용 값에 `Date` 파싱을 사용하지 않는다.
- `createdAt`과 `updatedAt`은 `Z`로 끝나는 UTC ISO instant이며 `updatedAt >= createdAt`을 지킨다.
- ID는 canonical 8-4-4-4-12 UUID 문자열이고 nil UUID는 허용하지 않는다. 버전·생성·유일성은 현재 검증 범위가 아니다.
- 필수 설명과 제공된 선택 문자열은 공백만으로 구성될 수 없다. 원본 문자열 자체는 trim하거나 수정하지 않는다.
- 거래 유형과 방향은 별도 축이며 실제 샘플 없이 허용 조합 matrix를 만들지 않는다.
- 생활비는 `EXPENSE + OUTFLOW`만 포함한다. `CARD_PAYMENT`, `TRANSFER`, `UNKNOWN`을 포함한 나머지는 후속 판정 전까지 포함하지 않는다.

## Scope

### Phase 2A — Transaction Domain

- `Transaction`, `TransactionType`, `Money`, `CalendarDate`의 현재 MVP 타입
- 양의 KRW 원 단위 safe integer와 별도 `direction` 규칙
- `YYYY-MM-DD` 날짜 전용 값의 런타임 검증
- 필수 원문 설명과 선택 Merchant·결제수단 필드의 경계
- `CARD_PAYMENT`와 `TRANSFER`를 생활비에서 제외하는 순수 판정 규칙
- `UNKNOWN`과 지원하는 모든 거래 유형의 명시적 처리
- 유효·무효·경계 입력을 다루는 table-driven Domain Test

### Phase 2B — 최소 저장 경계 결정

- Phase 3의 Confirmed Transaction 저장·조회에 실제 필요한 사용 사례 식별
- Native IndexedDB와 Dexie의 번들 크기, 마이그레이션, 테스트 가능성 비교
- 필요할 때만 Application 흐름과 Infrastructure 계약 정의
- DB version, transaction commit과 오류 경계의 최소 설계 기록

Phase 2B의 완료 의미는 저장 구현이 아니라 선택 근거와 재검토 조건의 기록이다. 현재 소비자가 없는 Repository·포트·DB schema는 만들지 않는다. Phase 3의 `confirmImport`에서 `ImportBatch + Transaction[]` 원자 저장과 날짜 조회가 실제로 필요해질 때 Native IndexedDB를 기본값으로 구현한다. 복합 쿼리·페이지네이션·반응형 조회·데이터 마이그레이션이 늘어나면 Dexie를 재평가한다.

## Out of Scope

- CSV/PDF/XLSX 읽기, Parser, Adapter와 Preview UI
- 실제 거래 저장 화면과 Dashboard 실제 집계
- 중복 탐지와 fingerprint
- Merchant 정규화, Category와 CategoryRule
- ImportBatch 최종 모델
- 실제 금융기관 또는 개인 금융 샘플
- 급여 추정 결과의 자동 저장 또는 `INCOME` Transaction 생성
- 백업·복원, 암호화, 동기화와 백엔드

## Dependencies

- `docs/architecture/data-model.md` Transaction MVP 기준선
- ADR-0001 파일 Import, ADR-0002 local-first 결정
- FR-002, FR-006, FR-007
- Phase 1의 TypeScript·Vitest·lint·build Toolchain
- [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)와 [트랜잭션 사용 안내](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB)
- [Dexie transaction](https://dexie.org/docs/Dexie/Dexie.transaction())과 [schema upgrade](https://dexie.org/docs/Version/Version.upgrade()) 문서

새 라이브러리는 비교 근거와 현재 사용 사례가 있을 때만 추가한다. 저장 구현을 시작하기 전에 Native IndexedDB로 충분한지 먼저 확인한다.

## Tasks

1. Data Model의 필드와 불변식을 구현 직전 다시 검토하고 미결정 항목을 Scope 밖에 유지한다.
2. 금액, 날짜, 방향과 거래 유형을 프레임워크에 독립된 Domain 타입·순수 함수로 구현한다.
3. 정상값, 0·음수·소수·safe integer 초과, 잘못된 날짜와 거래 유형 경계를 테스트한다.
4. 생활비 포함·제외 판정에서 `CARD_PAYMENT`와 `TRANSFER` 중복 집계 방지 규칙을 테스트한다.
5. 급여 추정 결과와 Transaction 사이에 import 또는 영속 의존성이 없는지 확인한다.
6. Phase 3 저장·조회 사용 사례에 필요한 최소 포트는 소비자가 생길 때까지 보류한다고 기록한다.
7. Native IndexedDB와 Dexie를 비교하고 Native 우선·Dexie 재검토 조건을 기록한다.
8. lint, typecheck, test, build와 개인정보·Git 검사를 수행한다.
9. Domain과 저장 경계 결정을 기능 단위 로컬 커밋으로 분리한다.

## Acceptance Criteria

- 모든 Transaction 필수 필드와 지원 거래 유형이 TypeScript에서 명시된다.
- 금액은 0보다 큰 KRW 원 단위 safe integer이고 부호와 방향을 중복 표현하지 않는다.
- 날짜 전용 값은 유효한 `YYYY-MM-DD`로 검증되며 JavaScript UTC 변환에 의존하지 않는다.
- `CARD_PAYMENT`와 `TRANSFER`가 생활비 소비로 분류되지 않는 규칙이 자동 테스트로 고정된다.
- 유효하지 않은 외부 후보를 한 번에 설명할 수 있는 런타임 검증 결과가 정의된다.
- 급여 추정 결과는 Transaction 또는 `INCOME`으로 생성·저장되지 않는다.
- Phase 3의 첫 저장은 Native IndexedDB를 기본값으로 하며, 저장 포트·schema 구현을 지금 보류하는 이유와 Dexie 재검토 조건이 기록된다.
- Parser, 실제 금융 fixture, 중복·카테고리·실제 Dashboard 기능이 추가되지 않는다.
- lint, typecheck, test, build가 통과한다.
- 관련 변경이 지정된 형식의 기능 단위 로컬 커밋으로 분리된다.

## Risks

- Phase 3 요구를 예상해 필드를 과도하게 추가할 수 있다. 현재 Transaction 불변식에 필요한 필드만 구현한다.
- 런타임 검증 도구 도입이 Domain보다 커질 수 있다. 작은 순수 함수와 직접 타입 가드로 충분한지 먼저 확인한다.
- IndexedDB 포트가 범용 CRUD Repository가 될 수 있다. 실제 저장·조회 흐름에 필요한 메서드만 정의한다.
- 거래 방향과 경제적 유형을 혼합하면 집계가 틀어진다. 별도 축으로 유지하고 대표 조합을 테스트한다.

## Questions / Blockers

현재 구현 시작을 막는 질문은 없다. 저장 라이브러리와 구체 포트는 Phase 2A Domain 완료 뒤 실제 요구를 기준으로 결정한다.
