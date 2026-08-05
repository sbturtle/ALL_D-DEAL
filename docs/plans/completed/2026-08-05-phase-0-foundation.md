# Phase 0 — Agent Harness / Repository Foundation

- 상태: `DONE`
- 시작일: 2026-08-05
- 완료일: 2026-08-05

## Goal

사람과 Agent가 이전 대화에 의존하지 않고 같은 제품 목적, 설계 경계, 보안 원칙과 작업 흐름으로 프로젝트를 발전시킬 수 있는 최소 저장소 기반을 만든다.

## User Value

- 요구와 결정의 유실을 줄이고 변경 이유를 추적할 수 있다.
- 작은 기능 단위로 계획·검증·커밋하는 개발 흐름을 갖는다.
- 금융 데이터를 다루기 전에 저장·로그·샘플의 개인정보 경계를 명확히 한다.

## Current State

작업 시작 시 디렉터리는 비어 있었고 Git 저장소가 아니었다. 애플리케이션 코드, 의존성, 테스트와 프로젝트 문서도 없었다.

완료 시점에는 문서 기반과 Git 이력이 준비되었으며, 애플리케이션 구현은 의도적으로 시작하지 않았다.

## Scope

- Git 저장소와 민감한 샘플 제외 규칙
- `AGENTS.md`와 문서 탐색 구조
- Product Context, Requirements, Requirements History
- 파일 Import 전환, local-first, 주 1회 흐름 ADR
- 계층 아키텍처와 Transaction MVP 데이터 모델
- 코드·테스트·개인정보·Git 규약
- 완료/중단 계획 구조와 Engineering Log
- 초기 Skill 필요성 판단
- Phase 1 최소 Vertical Slice 계획

## Out of Scope

- React/Vite 애플리케이션과 UI 구현
- IndexedDB 및 Transaction 런타임 구현
- CSV/PDF/XLSX Parser와 실제 금융기관 Adapter
- 중복 탐지, 카테고리 규칙, 자산 관리
- 백엔드, 동기화, PWA와 Android 앱
- 실제 금융 샘플 수집 또는 분석

## Dependencies

- 사용자 초기 구축 요구와 2026-08-05 Git 커밋 형식 요구
- 로컬 Git
- 외부 라이브러리와 네트워크 의존성 없음

## Completed Tasks

1. 저장소를 초기화하고 Phase 0 계획을 먼저 기록했다.
2. 작업 규칙, 문서 인덱스, 완료·중단 계획 경로를 만들었다.
3. 제품 배경, 현재 요구와 요구 변경 이력을 기록했다.
4. API에서 파일 Import로의 전환, local-first, 비실시간 결정을 ADR로 남겼다.
5. UI/Application/Domain/Infrastructure 경계와 Import 목표 흐름을 정의했다.
6. Transaction MVP 필드, 금액·날짜 불변식과 Phase별 확장을 정리했다.
7. 코드, 테스트, 개인정보, 샘플과 Git 커밋 규약을 정의했다.
8. 독립 Planner, Architect, Reviewer 관점으로 누락과 과설계를 검토했다.
9. Phase 1 계획을 현재 계획으로 전환했다.

## Acceptance Criteria

| 기준 | 결과 | 근거 |
| --- | --- | --- |
| 필수 문서가 모두 존재 | PASS | `docs/README.md` 인덱스와 파일 존재 검사 |
| API→File Import 변경을 추적 가능 | PASS | ADR-0001, ADR-0003, Requirements History |
| local-first 경계와 한계 기록 | PASS | ADR-0002, Architecture |
| 계층과 Adapter 책임 정의 | PASS | Architecture의 계층·Import 섹션 |
| MVP Transaction과 금액·날짜 규칙 정의 | PASS | Data Model, Code Convention |
| 실제 샘플 Git 제외 | PASS | `.gitignore`, Sample Data Policy, 추적 파일 검사 |
| Skill 도입 여부와 이유 기록 | PASS | 아래 Skill Decision |
| 복수 기능 단위 로컬 커밋 | PASS | Git log와 커밋 메시지 검사 |
| Phase 1 계획 준비 | PASS | `docs/plans/current-plan.md` |

## Verification

- 필수 파일과 디렉터리 존재: PASS
- 로컬 Markdown 링크 대상: PASS
- ADR 인덱스와 문서 간 연결: PASS
- Unicode replacement character 검사: PASS
- 실제 금융 샘플 추적 여부: PASS, 0개
- 커밋 제목 형식과 비어 있지 않은 본문: PASS
- `git diff --check`: PASS
- lint: N/A — 애플리케이션 Toolchain 미구축
- typecheck: N/A — TypeScript 코드 미구축
- test: N/A — 실행 코드 미구축
- build: N/A — 빌드 대상 미구축

## Risks

- 정확한 개인 재무 금액·지역·시점은 Git 문서에서 제외했다. 향후 Settings가 생기면 로컬 사용자 데이터로 입력한다.
- local-first는 암호화나 백업을 자동 보장하지 않는다. 실데이터 사용 전에 삭제 및 백업·복구 전략을 검토한다.
- 실제 금융 형식, 중복 판정, 환불 집계는 샘플과 사용 사례가 생길 때까지 보류했다.
- 초기 규약이 구현과 맞지 않으면 Phase별 근거를 남기고 최소 수정한다.

## Questions / Blockers

Phase 0를 막는 항목은 없었다. 프로젝트 이름, Settings 기본값, 첫 실제 금융기관 Adapter는 해당 기능 Phase에서 결정한다.

## Skill Decision

Repository 전용 Skill은 만들지 않았다. 후보 절차가 아직 실제 구현에서 반복되지 않았고, 지금 만들면 검증되지 않은 입력·출력과 명령을 고정하는 과설계가 되기 때문이다.

Phase 1 이후 계획·검증 절차가 두 번 이상 반복되거나 누락이 관찰되면 `verify-change`처럼 한 가지 목적을 가진 작은 Skill부터 검토한다.

## Outcome

`DONE` — Phase 0 Acceptance Criteria와 가능한 검증을 충족했다.
