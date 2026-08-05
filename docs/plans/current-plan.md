# Phase 3 — Legacy XLS Import Preview

- 상태: `NEEDS_USER_INPUT`
- 계획 갱신일: 2026-08-05
- 선행 조건: Phase 2 Transaction Domain `DONE`
- 근거: Git에서 제외된 `samples/private/`의 카드 이용내역·계좌 거래내역 XLS 구조

## Goal

사용자가 직접 선택한 계좌 거래·카드 이용 legacy XLS를 브라우저 안에서 읽고, 어떤 거래가 후보가 되는지와 자동 반영하지 않는 행을 저장 전에 Preview한다.

## User Value

- 실제 사용하는 파일 형식에 맞춰 계좌 거래와 카드 매입을 한 화면에서 검토할 수 있다.
- 카드 취소, 외화 후보, 날짜·금액 문제를 자동 반영하지 않고 이유와 함께 확인할 수 있다.
- 원본 파일은 브라우저 메모리에서만 사용하며 이번 slice에서는 장부가 바뀌지 않는다.

## Current Vertical Slice — Phase 3A (구현 완료, 로컬 브라우저 파일 선택 검증 대기)

- SheetJS `0.20.3`으로 브라우저 `File.arrayBuffer()`의 legacy XLS를 읽는다.
- 계좌 거래 레이아웃은 날짜·설명·출금·입금의 명확한 행만 `UNKNOWN` TransactionDraft 후보로 만든다.
- 카드 이용 레이아웃은 원화 매입 행만 `EXPENSE + OUTFLOW` TransactionDraft 후보로 만든다.
- 카드 취소·역분개와 외화 금액 행은 issue로 Preview하고, 원본 값은 오류에 넣지 않는다.
- 파일 선택, 처리 중 상태, 후보 수·확인 필요 수와 일부 후보 목록을 모바일 우선 UI로 제공한다.
- 원본 파일, 파일명, 전체 원본 행과 Preview 상태를 저장하지 않는다.

## Next Vertical Slice — Phase 3B

- Phase 3A의 실제 파일 Preview 확인 뒤, 사용자가 선택한 유효 후보만 Transaction으로 완성한다.
- Native IndexedDB schema v1의 `transactions`, `importBatches`에 하나의 transaction으로 저장한다.
- 실패 시 부분 저장 없이 Preview로 돌아가고, 성공 후에만 날짜 범위 조회를 제공한다.

## Import Contract

지원 레이아웃, 처리 제한, 행 issue 코드와 개인정보 경계는 [Legacy XLS Import Contract](../architecture/import-xls-contract.md)를 따른다. 테스트는 명백한 가짜 XLS 행 배열만 사용하며 `samples/private/` 파일과 실제 값은 Git에 추가하지 않는다.

## Out of Scope

- 실제 금융기관명·계정·카드 식별정보의 코드·문서·테스트 노출
- CSV, XLSX, PDF, 다중 시트, 암호화 파일과 금융기관 API
- 취소·환불의 자동 처리, 중복 fingerprint, Category, Dashboard 집계
- IndexedDB 저장과 급여 추정 결과 결합

## Tasks

1. `DONE` — private XLS 구조를 값·파일명 없이 분석하고 Import 계약에 기록했다.
2. `DONE` — 브라우저 XLS 파서와 계좌·카드 TransactionDraft 정규화를 구현했다.
3. `DONE` — 가짜 행 배열로 금액·날짜·취소·외화·식별정보 경계를 자동 테스트했다.
4. `DONE` — 파일 선택과 메모리 Preview UI를 구현하고 접근성 흐름을 테스트했다.
5. `NEEDS_USER_INPUT` — 실제 private XLS 두 종류의 로컬 브라우저 Preview는 Chrome 확장 프로그램의 로컬 파일 접근 권한을 켠 뒤 확인한다.
6. `DONE` — 독립 코드 리뷰, lint, typecheck, test, build와 개인정보·Git 검사를 수행했다.
7. `DONE` — 계약·의존성·정규화·UI·검증 결과를 기능 단위 로컬 커밋으로 분리했다.
8. `PENDING` — Phase 3A 수동 Preview 확인 뒤에만 Phase 3B Native IndexedDB 저장을 시작한다.

## Acceptance Criteria

- private XLS의 실제 값·파일명·금융 식별정보가 Git, fixture, 로그, 오류 메시지에 없다.
- 브라우저는 `.xls`만 최대 5 MiB로 읽고, 2,000행·20열·300자 셀 제한을 적용한다.
- 계좌 입금·출금 한쪽만 양의 KRW 정수인 행이 방향을 가진 `UNKNOWN` 후보가 된다.
- 카드 원화 매입 행만 `EXPENSE + OUTFLOW` 후보가 된다.
- 카드 취소·외화 후보·날짜·금액 오류는 자동 반영하지 않고 안전한 issue로 보인다.
- 카드 라벨은 별칭 또는 끝 4자리만 가지며 전체 식별정보를 보존하지 않는다.
- 파일 선택은 어떤 영속 데이터도 변경하지 않는다.
- lint, typecheck, test, build가 통과했다. private XLS 두 종류의 수동 Preview는 Chrome의 로컬 파일 접근 권한을 켠 뒤 통과시킨다.
- 변경은 `[Type] : 커밋 제목`과 비어 있지 않은 본문을 가진 기능 단위 로컬 커밋으로 분리한다.

## Risks

- legacy XLS는 겉보기 확장자와 실제 내용이 다를 수 있다. 파서가 성공하더라도 레이아웃 계약과 제한을 별도로 확인한다.
- 계좌의 경제적 유형을 추측하면 카드대금·이체·저축이 생활비에 중복 집계될 수 있다. 초기 후보는 `UNKNOWN`으로 유지한다.
- 카드 취소와 외화 거래를 EXPENSE로 자동 반영하면 실제 지출과 어긋날 수 있다. Preview 검토 대상으로 분리한다.
- 실제 파일 행을 테스트에 복사하면 개인정보가 유출될 수 있다. 가짜 행 배열과 구조 테스트만 사용한다.

## Questions / Blockers

Chrome 확장 프로그램이 실제 XLS 선택을 막고 있다. Chrome의 `chrome://extensions`에서 ChatGPT Chrome Extension의 **세부정보**를 열어 **파일 URL에 대한 액세스 허용**을 켜야 한다. 이 설정 뒤 실제 private XLS 두 종류를 브라우저 Preview로 확인하면 Phase 3A는 `DONE`이다. 취소·환불의 원거래 연결과 외화 환산은 실제 사용 사례를 확인한 뒤 별도 Phase에서 결정한다.
