# Phase 1 — Web Foundation & 급여 실수령 추정기

- 상태: `DONE`
- 시작일: 2026-08-05
- 완료일: 2026-08-05
- 계산 정책 기준일: 2026-03-01 세액표, 2026-07-01 국민연금 상·하한

## Goal

React, TypeScript, Vite 기반의 모바일 우선 브라우저 앱을 만들고, 저장하지 않는 급여 실수령 추정기를 첫 번째 실제 기능으로 제공한다. Dashboard의 빈 상태와 명시적인 Mock Data 상태도 함께 실행·검증한다.

## User Value

- 세전 기본 연봉 또는 월급, 연간 상여금과 비과세액을 입력해 상여 포함 연간·월평균 예상 실수령액을 확인할 수 있다.
- 국민연금, 건강보험, 장기요양보험, 고용보험, 근로소득세와 지방소득세의 예상 공제를 한 화면에서 이해할 수 있다.
- 계산 정책 기준일, 공식 출처, 주요 가정과 실제 금액이 달라질 수 있는 이유를 결과와 함께 확인할 수 있다.
- 입력값을 저장·전송하지 않고 계산기와 실제 거래 Dashboard의 개념을 분리한다.

## Current State

작업 시작 시에는 Phase 0 문서 기반만 있었고 애플리케이션 코드, Node 의존성, 자동 검증 명령과 급여 계산 정책 데이터가 없었다.

완료 시점에는 React 앱과 자동 검증 기반, 2026년 버전 급여 계산 Domain, 입력·결과 UX, Dashboard 빈 상태와 명시적인 Mock Data 모드가 준비되었다. 실제 금융 데이터, 브라우저 저장소, Transaction 구현과 Import Parser는 추가하지 않았다.

## Completed Scope

### Phase 1A — Web Skeleton

- React 19 + TypeScript + Vite 프로젝트와 Node 20.10 호환 의존성
- ESLint, Vitest, React Testing Library, jsdom 기반 자동 검증
- 모바일 우선 단일 페이지 shell
- 실제 거래가 없음을 설명하는 Dashboard와 명시적인 Mock Data 토글
- Phase 3 Import 진입점의 비활성 준비 상태

### Phase 1B — 급여 실수령 추정기

- 연봉·월급을 별도로 기억하는 입력 모드
- 연간 상여금, 월 비과세액, 본인 포함 가족·자녀 수, 80%·100%·120% 원천징수 선택
- 상여 포함 연간·월평균 세전액과 예상 실수령액
- 국민연금, 건강보험, 장기요양보험, 고용보험, 근로소득세, 지방소득세 내역
- 2026년 공식 근로소득 간이세액표 646개 연속 구간과 고액 계산식
- 정책 ID·기준일·공식 출처와 계산 한계·비저장 면책 안내
- 입력 오류 시 첫 필드 포커스, 성공 시 결과 포커스, 초기화와 계산 전 상태

## 계산 계약과 가정

- 기본 연봉·월급은 상여를 제외하고 비과세 수당을 포함한 세전 기본 급여다.
- 월 비과세액은 기본 급여 안에 이미 포함되므로 총액에 다시 더하지 않는다.
- 연간 상여금은 전액 과세로 가정하고 12개월 월평균에 정확히 한 번 반영한다.
- 연봉의 월평균 원 단위 미만은 버리되 연간 결과는 원래 연간 입력 총액을 유지한다.
- 사회보험은 월평균 보수 기반 간편 추정이며 회사 신고 보수·정산·감면·가입 제외는 반영하지 않는다.
- 소득세는 2026-03-01 시행 간이세액표, 자녀 차감과 선택 원천징수 비율을 적용한다.
- 상여 지급대상기간과 기납부세액을 입력받지 않으므로 지급월별 세액과 실수령액을 제공하지 않는다.
- 결과는 공식 급여명세서나 연말정산 결과가 아니다.

## Out of Scope 결과

- 입력·결과를 IndexedDB, localStorage, Settings, URL에 저장하지 않았다.
- 예상 급여를 Transaction 또는 `INCOME` 거래로 만들지 않았다.
- 정확한 지급월별 상여 원천징수, 연말정산, 퇴직금, 중도 입·퇴사와 비일반 근로 형태를 구현하지 않았다.
- 실제 금융 파일, Parser, 중복 탐지, Category, 실제 월간 집계를 구현하지 않았다.
- 백엔드, 배포, PWA와 Android 앱을 추가하지 않았다.

## Completed Tasks

1. FR-015~FR-020, ADR-0004와 Phase 1A·1B 경계를 문서에 기록했다.
2. React + TypeScript + Vite와 lint, typecheck, test, build 명령을 구성했다.
3. 공식 PDF의 간이세액표 770,000원~10,000,000원 646개 구간을 로컬 정책 데이터로 변환했다.
4. 급여 입력 검증, 월평균 정규화, 사회보험·세액·실수령 계산을 React와 분리된 순수 Domain으로 구현했다.
5. 공식 대표값, 표·고액 경계, 보험 상·하한, 절사와 금액 불변식을 Domain Test로 고정했다.
6. 입력 폼, 결과, 공제 내역, 정책 출처와 면책 안내를 모바일 우선 UI로 구현했다.
7. 모드 전환, 입력 오류, 결과 포커스, 초기화, 빈 장부와 Mock 상태를 Component Test로 검증했다.
8. 독립 Domain·UI 리뷰에서 발견된 정확성·접근성 문제를 반영했다.
9. 구현 변경을 문서, Build, Domain, UI 기능 단위 로컬 커밋으로 나눴다.

## Acceptance Criteria

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| 앱 실행·프로덕션 빌드 가능 | PASS | Vite 개발 명령 구성, `npm run build` 성공 |
| 연봉·월급·상여·비과세·가족·자녀·원천징수 입력 | PASS | UI 구현과 Component Test |
| 모드 전환 시 금액을 조용히 재해석하지 않음 | PASS | 모드별 상태 보존 Component Test |
| 상여를 연간·월평균에 한 번만 반영 | PASS | Domain·Component Test |
| 비과세액을 기본 급여에 재가산하지 않음 | PASS | 과세급여 정규화 Domain Test |
| 공제 합계와 실수령액 불변식 | PASS | 월·연 단위 Domain Test |
| KRW safe integer, 보험 상·하한과 단수 처리 | PASS | 경계·overflow·절사 Domain Test |
| 공식 3,500,000원·가족 4·자녀 2 예시 | PASS | 소득세 3,510원, 지방소득세 350원 테스트 |
| 예상 표현·정책·면책·비저장 안내 | PASS | 결과 UI와 Component Test |
| 오류·결과 포커스와 초기화 | PASS | Component Test와 독립 접근성 리뷰 |
| 입력·결과 비영속 및 Transaction 분리 | PASS | 저장·네트워크 API 정적 검사와 구조 리뷰 |
| 정확한 빈 Dashboard와 명시적인 Mock Data | PASS | 기본 빈 상태·Mock 토글 Component Test |
| 미구현 Import 상태 표시 | PASS | 비활성 Phase 3 Import 카드 |
| Parser·IndexedDB·백엔드 미도입 | PASS | 추적 소스와 의존성 검사 |
| 모바일 우선·키보드 동작 | PASS* | 320px 최소 폭·420px breakpoint 정적 리뷰와 키보드 중심 Component Test |
| lint, typecheck, test, build | PASS | 아래 Verification 결과 |
| 기능 단위 지정 형식 로컬 커밋 | PASS | Git 제목·본문 검사 |

`PASS*`: 자동 브라우저 시각 제어 없이 CSS 구조와 컴포넌트 상호작용을 검증했다. 실제 360px 브라우저의 시각 회귀 확인은 첫 수동 사용 시 추가한다.

## Verification

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | ESLint warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm run test` | PASS | 3 files, 34 tests |
| `npm run build` | PASS | Vite production build, 38 modules |
| 공식 세액표 추출 | PASS | 646개 연속 구간, 원문 SHA-256 `5307B1D45C8F946CA2D54F10B1731B2EC8CFD1A26EFB653673C13D660AE3B698` |
| 공식 PDF 수동 대조 | PASS | 표 시작·중간·고액 계산식 페이지와 대표 예시 확인 |
| Domain 독립 리뷰 | PASS | 중간 2개·낮음 2개 문제 반영 후 재검증 |
| UI 독립 리뷰 | PASS | 오류·결과 포커스, 설명 연결, 가독성, 정책 날짜 문제 반영 |
| 저장·네트워크 API 검사 | PASS | `localStorage`, `sessionStorage`, `indexedDB`, `fetch`, `console` 사용 0개 |
| 임시·민감 데이터 검사 | PASS | 공식 PDF·렌더·추출 스크립트 제거, 실제 개인 금융 fixture 0개 |
| `git diff --check` | PASS | 공백 오류 0개 |
| Git 메시지 제목·본문 | PASS | `[Type] : 제목`, 비어 있지 않은 본문 |

## Review에서 발견하고 반영한 문제

- 과세 월평균이 0원이 되는 입력이 보험 최저액을 우회하지 않도록 입력을 거부했다.
- 월급의 연간 환산이 safe integer 범위를 넘을 때 일반 오류 대신 검증 오류로 보고한다.
- 국민연금 최소 지원 금액을 하드코딩하지 않고 주입된 정책에서 읽도록 바꿨다.
- 고액 소득세 계산식의 30M·45M·87M 경계와 전후 1원을 추가 테스트했다.
- 오류 제출 시 첫 유효하지 않은 필드, 성공 시 결과 제목으로 포커스를 이동하고 시각적 포커스를 표시했다.
- 가족·자녀 도움말과 오류를 `aria-describedby`로 연결하고 핵심 안내문 크기·어두운 패널 포커스 대비를 보완했다.
- 정책 날짜 표시를 하드코딩하지 않고 버전 정책과 계산 결과에서 읽도록 바꿨다.

## 알려진 한계와 후속 연결

- 상여는 연간 총액의 12개월 평균이다. 실제 지급월 원천징수와 현금흐름은 다를 수 있다.
- 국민연금·건강보험은 회사가 신고한 보수와 정산분에 따라 추정치와 달라질 수 있다.
- 일반 직장근로자와 4대보험 전체 가입을 가정하며 예외·감면을 모두 지원하지 않는다.
- 입력과 결과는 새로고침하면 사라지고 실제 거래·Settings에 저장되지 않는다.
- Phase 2 Transaction Domain은 급여 추정 모듈과 독립적으로 구현한다.
- Phase 6에서 예상 급여와 실제 Import된 `INCOME`을 비교할 수 있지만 자동 합산하거나 대체하지 않는다.

## 관련 ADR

- ADR-0002 초기 버전에 local-first 아키텍처 채택
- ADR-0004 버전 지정 공식 정책으로 급여 실수령액 로컬 추정

## 기능 단위 커밋

- `7a72b90` `[Docs] : Phase 1 급여 추정기 요구와 범위 추가`
- `41e87e7` `[Build] : React 앱과 자동 검증 기반 구성`
- `032ca83` `[Feat] : 급여 추정 입력과 계산 도메인 추가`
- `3621fc2` `[Feat] : 실수령 추정 결과와 면책 UX 제공`

## Outcome

`DONE` — 요청한 연봉·월급·상여 기반 실수령 추정기와 Phase 1 Web Foundation을 구현하고 자동 검증·독립 리뷰를 완료했다. 현재 계획은 Phase 2 Transaction Domain Foundation으로 전환했다.
