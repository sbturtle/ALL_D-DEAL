# Phase 3 — Generic CSV Import

- 상태: `READY`
- 계획일: 2026-08-05
- 선행 조건: Phase 2 Transaction Domain `DONE`

## Goal

실제 금융기관 형식이 아닌 명시적인 `Generic Test Format` CSV를 브라우저 안에서 읽고, 행 단위 문제를 Preview한 뒤 사용자가 확인한 유효 거래만 Native IndexedDB에 원자적으로 저장한다.

## User Value

- 파일을 선택한 즉시 저장하지 않고 어떤 거래가 들어갈지 먼저 확인할 수 있다.
- 잘못된 행은 행 번호와 안전한 이유를 보고 수정하거나 제외할 수 있다.
- 확인한 거래만 로컬 장부에 반영되고 원본 파일과 전체 원본 행은 남지 않는다.

## Scope

### Phase 3A — Parse, Normalize, Preview

- 문서화된 Generic Test Format CSV 계약과 명백한 가짜 fixture
- 브라우저 파일 선택, 크기·헤더·행 수·문자열 길이 제한
- CSV 파싱과 행 단위 Source Record 문제 수집
- Phase 2 Transaction 후보 정규화와 런타임 검증
- 메모리 기반 Preview, 유효·오류 상태와 사용자 제외
- 원본 값과 금융 식별정보를 오류·로그에 노출하지 않는 경계

### Phase 3B — Confirm and Persist

- 실제 `confirmImport` 흐름에 필요한 최소 Application 계약
- Native IndexedDB schema v1의 `transactions`, `importBatches` 저장소
- `ImportBatch + Transaction[]` 단일 IndexedDB transaction commit
- 날짜 범위 기반 Transaction 조회와 저장 성공·실패 피드백
- 확정 후 Preview 메모리 정리

## Generic Test Format 초안

첫 구현 전에 헤더 이름, 날짜·금액·방향·유형 표현, 선택 필드와 UTF-8/따옴표 규칙을 문서와 테스트로 확정한다. fixture는 실제 사람, 상호, 계좌, 카드번호를 닮지 않은 가짜 데이터만 사용한다.

Phase 2에서 이미 완성된 Transaction을 파서 중간 상태로 억지 사용하지 않는다. 행의 출처와 오류를 유지하는 `ImportCandidate`를 메모리에 두고, 검증과 사용자 확인이 끝난 뒤 ID·시각·Import 출처를 완성한다.

## 저장 계약

- Native IndexedDB로 시작하고 별도 라이브러리를 우선 설치하지 않는다.
- 원본 CSV Blob, 파일명, 전체 원본 행과 확정 전 후보는 저장하지 않는다.
- 확정 작업은 ImportBatch와 모든 선택 Transaction이 함께 성공하거나 함께 실패해야 한다.
- DB 연결·트랜잭션 오류는 재시도 가능한 상태로 보고하되 원본 데이터를 메시지에 포함하지 않는다.
- 복합 쿼리, 페이지네이션, 반응형 조회나 다단계 마이그레이션이 실제 요구가 되면 Dexie를 재평가한다.

## Out of Scope

- 실제 은행·카드사 CSV/PDF/XLSX와 MyData 연동
- 실제 개인 금융 fixture
- 중복 fingerprint와 자동 삭제
- Merchant 정규화 규칙, Category와 CategoryRule
- 전체 Dashboard 집계와 급여 추정 비교
- 백업·복원, 암호화, PWA와 배포

## Tasks

1. Generic Test Format과 안전 제한을 문서·테스트로 확정한다.
2. CSV Parser를 선택하거나 작은 범위에서 직접 구현할지 요구와 번들 크기를 비교한다.
3. Parser·Normalizer·Preview 후보 계약을 최소 형태로 구현한다.
4. 유효·오류·제외 행을 보여 주는 접근 가능한 모바일 우선 UI를 구현한다.
5. Native IndexedDB schema v1과 확정 저장 Application 흐름을 구현한다.
6. 파싱 오류, 부분 실패, transaction rollback과 날짜 조회를 자동 테스트한다.
7. 독립 Domain·보안·UI 리뷰를 반영한다.
8. lint, typecheck, test, build와 실제 브라우저 핵심 흐름을 검증한다.
9. 문서·Parser·Preview·영속화처럼 기능 단위로 로컬 커밋한다.

## Acceptance Criteria

- 지원 CSV 계약과 제한이 코드보다 먼저 문서와 테스트에 명시된다.
- 파일 선택만으로 영속 데이터가 변경되지 않는다.
- 유효·오류·제외 행을 Preview에서 구분하고 오류가 여러 개면 모두 안전하게 표시한다.
- 확인한 유효 거래만 Transaction이 된다.
- ImportBatch와 선택 Transaction은 하나의 IndexedDB transaction으로 저장된다.
- 실패한 확정 작업은 부분 저장을 남기지 않고 사용자가 다시 시도할 수 있다.
- 원본 파일, 파일명, 전체 원본 행, 전체 금융 식별정보를 저장·로그·오류에 남기지 않는다.
- Phase 1 급여 추정 결과를 Import 거래와 합치거나 저장하지 않는다.
- 실제 금융 fixture, 중복 탐지, Category와 실제 Dashboard를 추가하지 않는다.
- lint, typecheck, test, build와 핵심 브라우저 흐름이 통과한다.
- 변경은 `[Type] : 커밋 제목`과 비어 있지 않은 본문을 가진 기능 단위 로컬 커밋으로 분리한다.

## Risks

- CSV 규칙을 너무 넓게 잡으면 실제 금융기관 Adapter와 범용 Parser가 섞인다. 첫 형식은 의도적으로 작고 명시적으로 유지한다.
- 브라우저 파일 API와 IndexedDB 테스트가 구현 세부사항에 묶일 수 있다. Domain·Application 계약을 먼저 검증하고 브라우저 adapter 테스트를 분리한다.
- 파일 내용을 오류나 테스트 출력에 넣으면 개인정보가 노출될 수 있다. 행 번호와 일반화된 오류 코드만 경계를 넘긴다.
- Preview와 저장 모델을 같은 객체로 공유하면 확정 전 데이터가 새어 나갈 수 있다. 메모리 후보와 저장 Transaction을 구분한다.

## Questions / Blockers

현재 구현 시작을 막는 질문은 없다. Generic Test Format을 실제 금융기관 형식과 혼동되지 않도록 이름·fixture·화면 안내에 명시한다.
