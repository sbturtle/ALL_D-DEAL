# Phase 1 — Minimal Web Skeleton

- 상태: `READY`
- 계획일: 2026-08-05

## Goal

React, TypeScript, Vite 기반의 브라우저 앱을 만들고 모바일 우선 Dashboard의 빈 상태와 명시적인 Mock Data 상태를 실행·검증한다.

## User Value

- 실제 금융 데이터를 넣기 전에 화면 구조와 핵심 정보의 우선순위를 확인할 수 있다.
- 작은 화면에서 이번 달 요약과 최근 거래를 빠르게 읽을 수 있다.
- 이후 Transaction Domain과 Import 흐름을 연결할 실행 가능한 기반을 얻는다.

## Current State

- Phase 0 문서 기반과 작업 규칙은 완료되었다.
- 애플리케이션 코드, `package.json`, Node 의존성과 자동 검증 명령은 아직 없다.
- 현재 저장소에는 실제 금융 데이터가 없다.

## Scope

- React + TypeScript + Vite 프로젝트 초기화
- 현재 Phase에 필요한 최소 ESLint, Vitest, React Testing Library 설정
- Mobile First 단일 Dashboard 화면
- 이번 달 수입, 생활비, 저축 요약 영역
- 최근 거래 빈 상태
- 명백한 가짜 값만 사용하는 Mock Data 모드와 최근 거래 목록
- 금융 데이터 가져오기 진입점의 준비 상태 표현
- 기본 접근성 및 반응형 스타일
- 실행·lint·typecheck·test·build 검증

## Out of Scope

- 공통 Transaction Domain의 최종 구현
- IndexedDB와 데이터 영속화
- CSV/PDF/XLSX 파일 읽기와 Import
- 중복 탐지와 카테고리 Rule
- 실제 월간 집계와 Settings 저장
- 백엔드, 배포, PWA, Android 앱
- 실제 금융 데이터 또는 실제 금융기관 형식을 닮은 fixture

## Dependencies

- 로컬 Node.js와 npm 실행 환경
- React, TypeScript, Vite
- Vitest, React Testing Library, DOM 테스트 환경
- ESLint

실제 설치 전에 로컬 Node/npm 버전과 패키지의 안정 버전을 확인한다. 의존성은 이 Scope에 필요한 것만 추가하고 lockfile을 커밋한다.

## Tasks

1. Node/npm 환경과 현재 Git 상태를 확인한다.
2. React + TypeScript + Vite 최소 프로젝트를 초기화한다.
3. lint, typecheck, test, build 명령을 구성하고 초기 상태에서 검증한다.
4. Dashboard 전용 View Model로 빈 상태를 구현한다.
5. 실제 사용자의 값과 분리된 Generic Mock Data 모드를 추가한다.
6. 360px 폭을 우선한 반응형 레이아웃과 키보드 접근성을 구현한다.
7. 빈 상태, Mock 상태, 기본 사용자 동작을 Component Test로 검증한다.
8. 가능한 경우 실제 브라우저에서 모바일·데스크톱 레이아웃을 확인한다.
9. Review 결과와 검증 근거를 문서에 반영하고 기능 단위로 커밋한다.

## Acceptance Criteria

- `npm run dev`로 브라우저에서 앱을 실행할 수 있다.
- 기본 화면은 실제 거래가 없는 상태를 정확히 설명한다.
- Mock Data가 실제 금융정보가 아님을 UI와 fixture 이름에서 알 수 있다.
- 이번 달 수입, 생활비 사용/목표, 저축과 최근 거래를 작은 화면에서 읽을 수 있다.
- 개인 재무 값은 Component에 하드코딩하지 않고 빈 상태 또는 Mock View Model에서 주입한다.
- 가져오기 기능이 아직 구현되지 않았다는 사실을 오해 없이 표현한다.
- 특정 금융 파일 Parser, IndexedDB와 백엔드 코드가 추가되지 않는다.
- lint, typecheck, test, build가 모두 통과한다.
- 관련 변경이 기능 단위 로컬 커밋으로 분리되고 지정된 메시지 형식을 따른다.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test -- --run`
- `npm run build`
- Component Test로 빈 상태와 Mock 상태 확인
- 가능하면 브라우저에서 360px와 넓은 화면의 overflow, 글자 잘림, 키보드 focus 확인
- `git diff --check`와 staged 민감정보 점검

## Risks

- Dashboard용 임시 View Model이 Phase 2 Domain 모델처럼 굳어질 수 있다. 이름과 위치로 UI fixture임을 명확히 한다.
- Mock 금액이 사용자 기본값으로 오해될 수 있다. 화면과 테스트에서 Mock임을 표시한다.
- 초기 Toolchain 설정이 기능보다 커질 수 있다. 현재 검증에 필요한 설정만 추가한다.
- 브라우저 수동 검증 환경이 없으면 자동 Component Test와 build까지만 증거로 남기고 한계를 기록한다.

## Questions / Blockers

현재 시작을 막는 질문은 없다.

- 패키지 매니저는 별도 선호가 없으므로 npm을 기본으로 한다.
- 제품명은 확정 전까지 일반적인 작업명인 “가계부”를 사용한다.
- 실제 사용자 생활비 목표는 사용하지 않고 빈 상태 또는 명시적인 가짜 Mock 값만 표시한다.
