# 2단계 — Transaction Domain 기초

- 상태: `DONE`
- 시작일: 2026-08-05
- 완료일: 2026-08-05

## 목표

금융기관별 파일 형식과 UI·저장 기술에 독립적인 최소 Transaction Domain을 구현하고, 이후 Import·중복 탐지·Dashboard가 공유할 금액·날짜·거래 유형·생활비 판정 불변식을 자동 테스트로 고정한다.

## 완료한 범위

- 양의 KRW 원 단위 safe integer 금액 검증
- 실제 달력에 존재하는 `YYYY-MM-DD` 전용 날짜 검증
- 9개 `TransactionType`, 유입·유출 방향과 MVP Transaction 타입
- nil이 아닌 canonical UUID와 UTC `Z` instant 검증
- 신뢰할 수 없는 `unknown` 입력을 위한 누적형 런타임 검증
- `EXPENSE + OUTFLOW`만 생활비로 포함하는 순수 판정 규칙
- Native IndexedDB 우선 도입과 Dexie 재평가 조건 결정

Parser, Preview UI, IndexedDB 코드, ImportBatch 구현, 중복 탐지와 실제 Dashboard 집계는 추가하지 않았다. 급여 추정 결과도 Transaction으로 저장하거나 자동 변환하지 않았다.

## 구현 계약

- 검증 실패는 예상 가능한 결과이며 throw하지 않는다. 한 번의 검증으로 발견한 모든 issue를 반환한다.
- plain object와 명시적으로 허용한 필드만 받으며 검증된 새 객체를 반환한다.
- 오류 메시지에는 후보 값, 예상하지 않은 필드명이나 전체 금융 식별정보를 노출하지 않는다.
- 설명과 선택 문자열은 공백만 허용하지 않되 원문을 임의로 trim하지 않는다.
- `paymentInstrumentLabel`은 별칭·끝 4자리 용도이며 ASCII 숫자 4개 초과 입력을 거부한다.
- `updatedAt`은 `createdAt`보다 빠를 수 없다.
- 생활비는 `type === 'EXPENSE' && direction === 'OUTFLOW'`인 경우만 포함한다.

## 저장 경계 결정

Phase 2에는 사용 사례가 없는 저장 포트, DB 스키마와 새 의존성을 만들지 않았다. Phase 3의 `confirmImport`가 `ImportBatch + Transaction[]` 원자 저장과 날짜 조회를 요구할 때 Native IndexedDB로 시작한다.

복합 쿼리, 페이지네이션, 반응형 조회 또는 여러 버전의 스키마 마이그레이션이 필요해지면 Dexie를 재평가한다. 근거 문서는 [MDN IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API), [MDN IndexedDB 사용 안내](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB), [Dexie transaction](https://dexie.org/docs/Dexie/Dexie.transaction()), [Dexie schema upgrade](https://dexie.org/docs/Version/Version.upgrade())다.

## 완료한 작업

1. Data Model과 Phase 2 구현 계약을 확정했다.
2. 금액과 CalendarDate의 정상·경계·오류 입력을 table-driven test로 고정했다.
3. Transaction 타입과 런타임 검증을 구현했다.
4. 생활비 중복 집계 방지 규칙을 구현했다.
5. 독립 코드 리뷰에서 발견한 신뢰 경계와 금융 식별정보 문제를 수정했다.
6. 저장 기술을 실제 Phase 3 사용 사례까지 보류하고 Native IndexedDB 기본값과 Dexie 재평가 조건을 기록했다.
7. lint, typecheck, test, build와 정적 개인 정보 검사를 통과했다.
8. 변경을 문서·금액/날짜·Transaction·생활비·보안 수정 단위의 로컬 커밋으로 나눴다.

## 완료 기준

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| 모든 MVP 필드와 9개 거래 유형 명시 | PASS | `transaction.ts`, 타입·런타임 테스트 |
| 양의 KRW safe integer | PASS | 금액 경계 테스트 |
| 시간대 변환 없는 실제 CalendarDate | PASS | 윤년·월 경계 테스트 |
| 누적형 `unknown` 런타임 검증 | PASS | 정상·다중 오류·객체 신뢰 경계 테스트 |
| 카드대금·이체 생활비 중복 방지 | PASS | 모든 유형·방향 조합 테스트 |
| 금융 식별정보 비저장·비노출 | PASS | 결제수단 숫자 제한과 오류 메시지 테스트 |
| 급여 추정 모듈과 독립 | PASS | import·의존성 정적 검사 |
| Parser·DB·미래 포트 미도입 | PASS | 소스·의존성 정적 검사 |
| lint, typecheck, test, build | PASS | 아래 Verification 결과 |
| 지정 형식의 기능 단위 로컬 커밋 | PASS | Git 제목·본문 검사 |

## 검증

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint warning 0개 |
| `npm run typecheck` | PASS | TypeScript 프로젝트 빌드 성공 |
| `npm run test` | PASS | 8개 파일, 208개 테스트 |
| `npm run build` | PASS | Vite 프로덕션 빌드, 38개 모듈 |
| 독립 계약·코드 리뷰 | PASS | 모델 경계, plain object, 오류 정보 노출 검토 |
| 저장·네트워크·급여 결합 검사 | PASS | Phase 2 Domain에 해당 의존성 0개 |
| 실제 금융 fixture 검사 | PASS | 실제 개인 금융 데이터 0개 |
| 브라우저 수동 확인 | N/A | 이번 Phase에는 UI 변경 없음 |
| `git diff --check` | PASS | 공백 오류 0개 |
| Git 메시지 제목·본문 | PASS | `[Type] : 제목`, 비어 있지 않은 본문 |

## 검토에서 발견하고 반영한 문제

- 예상하지 않은 후보 필드명이 issue 경로에 노출되지 않도록 일반화된 `$root` 오류로 바꿨다.
- 배열뿐 아니라 `Date`, `Map`, 클래스 인스턴스도 Transaction 루트로 통과하지 못하도록 plain object 경계를 추가했다.
- `paymentInstrumentLabel`에 전체 카드·계좌번호처럼 보이는 숫자가 저장되지 않도록 ASCII 숫자를 최대 4개로 제한했다.
- 민감 입력을 거부할 때도 오류 메시지에 실제 값을 되비추지 않도록 테스트로 고정했다.

## 알려진 한계와 후속 연결

- UUID 버전과 저장소 수준 유일성은 Phase 3 영속화 경계에서 다룬다.
- 거래 유형과 방향의 허용 조합은 실제 Generic CSV 후보가 생긴 뒤 필요한 만큼 추가한다.
- `REFUND` 원거래 연결, 중복 fingerprint와 Category는 각각 후속 Phase에서 다룬다.
- Native IndexedDB 스키마와 포트는 Phase 3의 첫 확정 저장 흐름에서 최소 형태로 정의한다.

## 직접 따라가는 순서

1. [Data Model](../../architecture/data-model.md)에서 필드와 불변식을 먼저 본다.
2. [금액 경계](../../../src/domain/transactions/money.ts)와 [달력 날짜 경계](../../../src/domain/transactions/calendar-date.ts)에서 작은 값 객체 검증을 본다.
3. [Transaction 타입](../../../src/domain/transactions/transaction.ts)에서 최종 데이터 모양을 본다.
4. [런타임 검증](../../../src/domain/transactions/transaction-validation.ts)에서 `unknown`이 Transaction이 되는 경계를 따라간다.
5. [생활비 판정](../../../src/domain/transactions/living-expense.ts)에서 Dashboard 중복 집계 방지 규칙을 본다.
6. 각 파일 옆의 `*.test.ts`를 열어 허용·거부 사례를 함께 읽는다. 특히 [Transaction 검증 테스트](../../../src/domain/transactions/transaction-validation.test.ts)가 전체 계약의 실행 가능한 설명서다.
7. [Phase 3 현재 계획](../current-plan.md)에서 이 Domain을 CSV Preview와 확정 저장에 어떻게 연결할지 본다.

직접 확인할 때는 `npm run test -- src/domain/transactions`로 이 영역만 실행하고, 전체 상태는 `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` 순서로 확인한다.

## 기능 단위 커밋

- `88c324e` `[Docs] : Phase 2 Transaction 구현 계약 확정`
- `43306f6` `[Feat] : 거래 금액과 달력 날짜 경계 추가`
- `7a4edd4` `[Feat] : Transaction 타입과 런타임 검증 추가`
- `9c1c505` `[Feat] : 생활비 중복 집계 방지 규칙 추가`
- `353d142` `[Fix] : Transaction 검증 신뢰 경계 강화`
- `a837eb0` `[Fix] : 결제수단 금융 식별정보 저장 차단`
- `[Docs] : Phase 2 검증 결과와 다음 계획 인계`

## 결과

`DONE` — Phase 2 Transaction Domain과 생활비 판정 규칙을 구현하고 208개 자동 테스트와 독립 리뷰를 통과했다. 현재 계획은 Phase 3 Generic CSV Import로 전환했다.
