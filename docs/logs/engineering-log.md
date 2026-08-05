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

## 2026-08-05 — Phase 1 Web Foundation & 급여 실수령 추정기

### 작업 목적

Phase 1 실행 기반과 Dashboard shell을 만들고, 사용자가 연봉 또는 월급과 상여·비과세 조건을 넣어 2026년 기준 예상 실수령액을 확인할 수 있는 메모리 전용 계산기를 첫 실제 기능으로 제공한다.

### 변경 파일

- 실행 기반: `package.json`, `package-lock.json`, TypeScript·Vite·ESLint 설정, `src/main.tsx`
- 급여 Domain: `src/domain/payroll-estimate/`
- 계산기 UI: `src/ui/payroll-estimate/`, `src/shared/format/currency.ts`
- Dashboard: `src/ui/dashboard/`
- 앱·스타일·테스트: `src/app/`, `src/test/setup.ts`
- 제품·결정·계획: `docs/product/requirements.md`, `docs/adr/ADR-0004-versioned-local-payroll-estimation.md`, `docs/plans/`
- 아키텍처·작업 이력: `docs/architecture/architecture.md`, 이 문서

### 구현 내용

- React 19, TypeScript, Vite와 lint, typecheck, Vitest, React Testing Library, production build 명령을 구성했다.
- 연봉·월급 모드를 구분하고 연간 상여금, 월 비과세액, 가족·자녀 수와 80%·100%·120% 원천징수를 입력받는다.
- 공식 2026-03-01 근로소득 간이세액표의 770,000원~10,000,000원 646개 구간과 고액 계산식을 로컬 TypeScript 정책 데이터로 포함했다.
- 2026년 하반기 국민연금과 건강·장기요양·고용보험 기준을 버전 정책으로 분리하고 React와 독립된 순수 함수로 계산한다.
- 상여 포함 연간·월평균 세전액, 6개 공제 내역과 예상 실수령액을 정책 기준일·공식 출처·면책과 함께 표시한다.
- 상여는 연간 총액의 12개월 평균으로만 반영하고 지급월별 정확한 원천징수는 지원하지 않음을 명시했다.
- 입력값·결과는 외부 전송이나 브라우저 저장 없이 현재 React 상태에서만 사용한다. 실제 Transaction과 자동 합산·생성하지 않는다.
- 기본 Dashboard는 실제 거래가 없음을 설명하고 별도 토글에서만 명백한 Mock fixture를 표시한다.

### 검증 방법과 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm run test` | PASS | 3 files, 34 tests |
| `npm run build` | PASS | 38 modules production build |
| 공식 세액표 연속성·대표값 | PASS | 646개 구간, 공식 가족·자녀 예시와 고액 경계 |
| 사회보험 상·하한·절사 | PASS | 국민연금·건강보험 경계와 10원 단수 테스트 |
| 계산 불변식 | PASS | 월·연 공제 합계와 세전-공제=예상 실수령 |
| Component 흐름 | PASS | 모드 보존, 오류·결과 포커스, 상여 반영, 초기화, 빈·Mock 상태 |
| 비영속·외부 요청 검사 | PASS | storage, IndexedDB, fetch, console 사용 0개 |
| 임시·민감 데이터 검사 | PASS | 추출 임시 파일 제거, 실제 개인 금융 fixture 0개 |
| `git diff --check` | PASS | 공백 오류 0개 |
| Git 메시지 형식·본문 | PASS | 기능 단위 4개 구현 커밋 확인 |

모바일 레이아웃은 320px 최소 폭과 420px breakpoint를 코드 리뷰했고, 키보드 흐름은 Component Test로 검증했다. 자동 브라우저 시각 제어는 수행하지 않았으므로 실제 360px 시각 회귀 확인은 첫 수동 사용 때 보완한다.

### Review에서 발견하고 반영한 문제

- 과세 월평균 0원 입력의 최저 보험료 우회와 월급 연간 환산 overflow를 검증 오류로 차단했다.
- 국민연금 최소 지원액을 정책 주입값으로 읽고 소득세 30M·45M·87M 경계를 추가 테스트했다.
- 테스트 DOM cleanup을 명시해 Component 간 중복 ID와 상태 누수를 제거했다.
- 오류 제출 시 첫 필드, 성공 시 결과 제목으로 포커스를 이동하고 결과 포커스 링을 복원했다.
- 가족·자녀 설명 연결, 핵심 안내 글자 크기와 어두운 결과 패널의 포커스 대비를 보완했다.
- 화면의 정책 날짜를 하드코딩하지 않고 정책·결과 값에서 표시하도록 바꿨다.

### 남은 TODO

- Phase 2에서 Transaction MVP 타입과 금액·날짜·거래 유형 불변식을 구현한다.
- Native IndexedDB와 Dexie를 실제 저장 사용 사례 기준으로 비교하고 최소 저장 경계를 결정한다.
- 급여 추정 결과는 비영속 도구로 유지하고 실제 Import된 `INCOME`과 분리한다.
- Phase 3 전까지 금융 파일 Parser와 실제 저장·Preview를 구현하지 않는다.

### 관련 ADR

- ADR-0002 초기 버전에 local-first 아키텍처 채택
- ADR-0004 버전 지정 공식 정책으로 급여 실수령액 로컬 추정

### 기능 단위 커밋

- `7a72b90` `[Docs] : Phase 1 급여 추정기 요구와 범위 추가`
- `41e87e7` `[Build] : React 앱과 자동 검증 기반 구성`
- `032ca83` `[Feat] : 급여 추정 입력과 계산 도메인 추가`
- `3621fc2` `[Feat] : 실수령 추정 결과와 면책 UX 제공`

### 상태

`DONE`

## 2026-08-05 — Phase 2 Transaction Domain Foundation

### 작업 목적

Generic CSV Import 전에 모든 입력 형식과 Dashboard가 공유할 최소 Transaction 타입, 금액·날짜·시간 검증과 생활비 중복 집계 방지 규칙을 구현한다. 저장 기술은 실제 확정 저장 사용 사례에 맞춰 결정하되 Phase 2에서는 미사용 포트와 DB 코드를 만들지 않는다.

### 변경 파일

- Transaction Domain: `src/domain/transactions/`
- 모델·아키텍처: `docs/architecture/data-model.md`, `docs/architecture/architecture.md`
- 요구·계획: `docs/product/requirements.md`, `docs/plans/`
- 작업 이력: 이 문서

### 구현 내용

- 양의 KRW 원 단위 safe integer와 실제 `YYYY-MM-DD` CalendarDate 경계를 구현했다.
- 9개 거래 유형, 유입·유출 방향과 MVP Transaction 타입을 구현했다.
- nil이 아닌 canonical UUID, UTC `Z` instant와 수정 시각 순서를 검증한다.
- `unknown` 입력의 모든 issue를 수집하고 허용 필드만으로 새 Transaction 객체를 만드는 런타임 검증을 구현했다.
- `EXPENSE + OUTFLOW`만 생활비로 포함해 카드대금, 이체와 다른 자금 이동의 중복 집계를 막았다.
- 결제수단 라벨의 ASCII 숫자를 최대 4개로 제한해 전체 카드·계좌번호 저장을 차단했다.

### 저장 결정

- Phase 2에는 IndexedDB 코드, 저장 포트와 새 의존성을 추가하지 않았다.
- Phase 3 `confirmImport`의 `ImportBatch + Transaction[]` 원자 저장과 날짜 조회는 Native IndexedDB로 시작한다.
- 복합 쿼리, 페이지네이션, 반응형 조회나 다단계 마이그레이션이 필요해지면 Dexie를 재평가한다.

### 검증 방법과 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm run test` | PASS | 8 files, 208 tests |
| `npm run build` | PASS | Vite production build, 38 modules |
| Domain 독립 리뷰 | PASS | 모델·날짜·금액·생활비 경계 확인 |
| 보안 신뢰 경계 리뷰 | PASS | plain object 제한, 후보 키·값 비노출 반영 |
| 저장·네트워크·급여 결합 검사 | PASS | Phase 2 Domain 의존성 0개 |
| 실제 금융 fixture 검사 | PASS | 실제 개인 금융 데이터 0개 |
| 브라우저 수동 확인 | N/A | UI 변경 없음 |
| `git diff --check` | PASS | 공백 오류 0개 |

### Review에서 발견하고 반영한 문제

- 예상하지 않은 후보 필드명이 issue 경로에 노출되던 문제를 일반화된 `$root` 오류로 수정했다.
- `Date`, `Map`, 클래스 인스턴스가 객체 입력으로 처리될 가능성을 plain object 경계로 차단했다.
- 전체 카드·계좌번호처럼 보이는 `paymentInstrumentLabel`과 입력값을 되비추는 오류 메시지를 차단했다.

### 남은 TODO

- Phase 3에서 Generic Test Format CSV 계약과 안전 제한을 먼저 확정한다.
- 메모리 기반 Parse·Normalize·Preview 흐름을 구현한다.
- 확인된 거래만 Native IndexedDB schema v1에 원자 저장한다.
- 중복 fingerprint와 실제 금융기관 Adapter는 각각 Phase 4와 Phase 7까지 구현하지 않는다.

### 기능 단위 커밋

- `88c324e` `[Docs] : Phase 2 Transaction 구현 계약 확정`
- `43306f6` `[Feat] : 거래 금액과 달력 날짜 경계 추가`
- `7a4edd4` `[Feat] : Transaction 타입과 런타임 검증 추가`
- `9c1c505` `[Feat] : 생활비 중복 집계 방지 규칙 추가`
- `353d142` `[Fix] : Transaction 검증 신뢰 경계 강화`
- `a837eb0` `[Fix] : 결제수단 금융 식별정보 저장 차단`
- `[Docs] : Phase 2 검증 결과와 다음 계획 인계`

### 상태

`DONE`
