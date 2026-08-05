# Phase 0 — Agent Harness / Repository Foundation

## Goal

앞으로 사람과 Agent가 이전 대화에 의존하지 않고 같은 원칙으로 프로젝트를 발전시킬 수 있도록 최소 문서 기반과 작업 규칙을 구축한다.

## User Value

- 요구와 결정이 유실되거나 서로 어긋나는 위험을 줄인다.
- 작은 기능 단위로 계획·검증·커밋하는 일관된 개발 흐름을 만든다.
- 민감한 금융 데이터를 다루기 전에 보안 경계를 명확히 한다.

## Current State

- 2026-08-05 기준 작업 디렉터리는 비어 있었고 Git 저장소가 아니었다.
- 애플리케이션 코드, 의존성, 테스트, 문서가 존재하지 않았다.
- 사용자가 Phase 0 구축과 기능 단위 로컬 커밋을 요청했다.

## Scope

- Git 저장소 초기화와 민감한 샘플을 제외하는 `.gitignore`
- 짧은 저장소 운영 규칙인 `AGENTS.md`
- 제품 배경, 현재 요구, 요구 변경 이력
- local-first와 파일 Import 전환을 설명하는 초기 ADR
- 아키텍처 및 MVP 데이터 모델 초안
- 코드·테스트·개인정보 처리 규약
- 계획, 완료/중단 기록 구조, 엔지니어링 로그
- 반복 업무를 위한 Skill 도입 시점 판단
- Phase 1 최소 Vertical Slice 계획

## Out of Scope

- React/Vite 애플리케이션과 UI 구현
- IndexedDB 및 Transaction 런타임 구현
- CSV/PDF/XLSX 파서와 실제 금융기관 Adapter
- 중복 탐지, 카테고리 규칙, 자산 관리 기능
- 백엔드, 클라우드 동기화, PWA, Android 앱
- 실제 금융 샘플 수집 또는 분석

## Dependencies

- Phase 0 문서 작업에는 외부 라이브러리가 필요하지 않다.
- Phase 1은 Node.js와 npm을 사용하되 실제 초기화 시 설치 버전을 확인한다.
- 실제 금융기관 Adapter는 사용자가 제공하는 마스킹된 샘플 없이는 시작하지 않는다.

## Tasks

1. 저장소 운영 규칙과 문서 탐색 구조를 만든다.
2. 제품 맥락, 현재 요구, 요구 변경 이력을 기록한다.
3. 핵심 제품·아키텍처 결정을 ADR로 작성한다.
4. 아키텍처, MVP 데이터 모델, 코드 규약을 작성한다.
5. 문서 간 정합성과 개인정보 보호 규칙을 검토한다.
6. Phase 0 결과와 검증 내용을 엔지니어링 로그에 남긴다.
7. 완료 계획을 보관하고 Phase 1 계획을 현재 계획으로 전환한다.

## Acceptance Criteria

- `AGENTS.md`가 상세 문서를 복제하지 않고 핵심 규칙과 문서 경로를 안내한다.
- 필수 문서인 Product Context, Requirements, Requirements History, ADR, Architecture, Code Convention, Current Plan, Blocked Plan, Engineering Log가 존재한다.
- 금융 API 자동 연동에서 주 1회 파일 Import로 바뀐 배경과 local-first 결정이 추적 가능하다.
- 아키텍처 문서가 UI, Application, Domain, Infrastructure 경계와 의존성 방향을 설명한다.
- 데이터 모델 문서가 MVP Transaction 필드와 금액·날짜 처리 근거를 설명한다.
- 실제 금융 데이터가 Git에 들어가지 않도록 경로와 규칙이 마련된다.
- 초기 Skill을 만들거나 만들지 않은 이유가 기록된다.
- 변경사항이 기능 단위의 복수 로컬 커밋으로 남는다.

## Verification

- 필수 파일과 디렉터리 존재 여부를 검사한다.
- 문서 내부 경로와 ADR 인덱스가 실제 파일을 가리키는지 검사한다.
- `git status`와 `git log`로 민감한 샘플 제외 및 커밋 분할을 확인한다.
- 애플리케이션 코드가 없는 Phase이므로 lint, typecheck, test, build는 적용 대상이 아니다.

## Risks

- 코드 없이 미리 정한 규칙이 실제 구현과 맞지 않을 수 있다. Phase 1에서 검증하고 최소 수정한다.
- 금융기관별 형식은 샘플 없이 확정할 수 없다. 공통 경계만 정하고 구체 파싱 규칙은 보류한다.
- 문서가 과도해질 수 있다. 의사결정에 필요한 근거만 유지하고 중복 서술을 피한다.

## Questions / Blockers

- Phase 0 진행을 막는 질문은 없다.
- 패키지 매니저와 세부 UI 선택은 Phase 1 초기화 시 합리적인 기본값을 사용하고 기록할 수 있다.

## Skill Strategy

초기 Skill 후보는 `plan-feature`, `verify-change`, `review-change`, `update-project-docs`, `create-adr`, `transaction-import`이다. 현재는 각 흐름이 한 번도 실제 코드 작업에서 반복되지 않았으므로 Skill을 만들지 않는다. Phase 1~3에서 동일 절차가 두 번 이상 반복되거나 실수가 확인되면 가장 작은 단일 목적 Skill부터 도입한다.
