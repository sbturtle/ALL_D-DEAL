# Engineering Log

중요한 작업의 목적, 변경, 검증과 후속 과제를 기록한다. 사소한 편집보다 다른 작업자가 결정의 맥락을 복원하는 데 필요한 내용을 우선한다.

## 2026-08-05 — Phase 0 Agent Harness / Repository Foundation

### 작업 목적

비어 있는 작업 디렉터리에 개인 가계부 프로젝트의 제품·아키텍처·개발 운영 기준선을 만들고, 이후 기능을 작은 단위로 안전하게 진행할 수 있게 한다.

### 변경 파일

- 저장소 운영: `.gitignore`, `AGENTS.md`, `docs/README.md`
- 제품: `docs/product/`
- 결정: `docs/adr/`
- 구조: `docs/architecture/`
- 규약: `docs/conventions/`
- 계획: `docs/plans/`
- 샘플 정책: `samples/`

### 구현 내용

- 금융 API 자동 연동 대신 사용자 주도 파일 Import를 우선하는 배경을 기록했다.
- 브라우저 내부 처리와 IndexedDB를 지향하는 local-first 경계 및 비실시간 주간 사용 흐름을 결정했다.
- UI, Application, Domain, Infrastructure의 최소 책임과 목표 Import 흐름을 정의했다.
- 양의 최소 통화 단위 정수와 별도 방향을 사용하는 Transaction MVP 기준선을 정했다.
- 실제 금융 샘플, 원본 행과 식별정보가 저장소·로그·테스트에 남지 않도록 규칙을 추가했다.
- 사용자 요청에 따라 `[Type] : 커밋 제목`과 비어 있지 않은 본문을 사용하는 기능 단위 로컬 커밋 정책을 반영했다.
- 반복 근거가 없는 Repository 전용 Skill 생성은 보류했다.

### 검증 방법과 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| 필수 파일·디렉터리 검사 | PASS | Phase 0 필수 구조 존재 |
| 로컬 Markdown 링크 검사 | PASS | 끊어진 상대 링크 0개 |
| ADR/요구사항 정합성 리뷰 | PASS | 역할 중복과 Phase 범위 보완 |
| 개인정보·샘플 추적 검사 | PASS | `samples/private/` 추적 파일 0개 |
| Unicode replacement character 검사 | PASS | 깨진 대체 문자 0개 |
| `git diff --check` | PASS | Markdown 끝 공백 보정 후 통과 |
| Git 메시지 형식·본문 검사 | PASS | 기능 단위 복수 커밋 확인 |
| lint | N/A | 앱 Toolchain 없음 |
| typecheck | N/A | TypeScript 코드 없음 |
| test | N/A | 실행 코드 없음 |
| build | N/A | 빌드 대상 없음 |

### Review에서 발견하고 반영한 문제

- 추적 문서에 있던 구체적인 개인 재무 금액·지역·시점을 목표 맥락으로 일반화했다.
- Generic Test CSV와 실제 금융기관 파일 요구를 Phase 3과 Phase 7로 분리했다.
- local-first가 암호화나 완전한 오프라인 배포를 보장한다는 오해를 막았다.
- Merchant가 없는 급여·이체를 위해 필수 `descriptionOriginal`과 선택 `merchantOriginal`을 분리했다.
- `git diff --check`가 찾은 Markdown 끝 공백과 파일 끝 빈 줄을 제거했다.

### 남은 TODO

- Phase 1에서 React + TypeScript + Vite 기반 최소 Web Skeleton을 구축한다.
- 빈 상태와 명시적인 Mock Data Dashboard를 모바일 우선으로 구현한다.
- lint, typecheck, test, build 명령을 실제 프로젝트 명령으로 확정한다.
- 실제 금융 데이터, IndexedDB, Import Parser는 해당 후속 Phase 전까지 구현하지 않는다.

### 관련 ADR

- ADR-0001 금융 API 직접 연동보다 파일 Import 우선
- ADR-0002 초기 버전에 local-first 아키텍처 채택
- ADR-0003 실시간 동기화보다 주 1회 Import 최적화

### 상태

`DONE`
