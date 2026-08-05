# Engineering Log

## 2026-08-05 — Phase 5 Confirmed Category Rules

### 작업 목적

Legacy XLS Preview에서 거래별 카테고리를 사용자가 직접 확인·수정하고, 같은 정규화 설명에 대해서만 다음 Preview에 재사용할 수 있는 명시적 규칙을 로컬에 저장한다. 자동 분류는 저장 확정 전 항상 보이고 수정 가능해야 하며, 기존 원장은 바꾸지 않는다.

### 변경 내용

- `FOOD_DINING`부터 `OTHER`까지 9개 고정 카테고리와 선택적 `Transaction.categoryId`를 추가했다. 값이 없으면 기존 거래와 동일하게 미분류다.
- 설명을 NFKC·소문자·기호 공백화·공백 정리로 정규화한 정확 일치 키의 `CategoryRule`을 추가했다. 300자를 넘거나 연속 숫자 5자리 이상을 포함한 설명은 새 규칙으로 저장하지 않는다.
- IndexedDB v2의 `categoryRules` 저장소를 추가하고, 선택 거래·ImportBatch·확정 규칙을 하나의 read-write transaction으로 저장한다. 규칙 교체는 이전 Transaction을 수정하지 않는다.
- 저장된 규칙은 새 Preview에만 미리 채우며, 사용자는 후보별 선택 상자에서 수정할 수 있다. 카테고리 저장과 “이 거래 설명에 앞으로 적용” 동의를 분리했고, 선택하지 않은 중복 후보는 규칙을 만들 수 없다.
- Dashboard의 저장 거래 메타데이터에 카테고리(또는 미분류)를 표시했다.
- 다른 탭의 스키마 업그레이드 차단 또는 종료 이벤트 없는 IndexedDB 열기 요청은 각각 안전하게 실패시켜 화면이 무한 로딩되지 않도록 했다. 후자는 5초 제한을 둔다.

### 검증 방법과 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm test` | PASS | 22 files, 274 tests |
| `npm run build` | PASS | Vite production build 성공 |
| Domain/Application/UI/저장소 테스트 | PASS | 정규화·민감 숫자 거부·규칙 재사용/교체·원자 rollback·v1→v2 마이그레이션·중복 제외·무응답 저장소 안전 실패 검증 |
| 브라우저 수동 점검 | PASS | `PHASE 5 · LOCAL` 표시와 저장소 무응답 5초 뒤 안전 오류 상태 확인; 개인 XLS는 열거나 저장하지 않음 |
| 개인정보 경계 | PASS | 실제 XLS·파일명·원본 행을 테스트·로그·커밋에 사용하지 않음 |
| `git diff --check` | PASS | 최종 문서 커밋 전 재확인 예정 |

프로덕션 빌드는 기존 SheetJS 포함 JavaScript 청크가 500 kB를 넘는다는 경고만 출력했다. 동작 실패는 없으며, 코드 분할은 별도 성능 작업으로 남긴다.

### 리뷰에서 반영한 사항

- 규칙 키가 계좌·카드 식별자를 새로 보관하는 경로가 되지 않도록 긴 연속 숫자를 거부했다.
- 규칙이 자동 저장이나 과거 원장 재분류로 해석되지 않도록 Preview 전용 적용과 별도 동의를 계약에 명시했다.
- IndexedDB의 `blocked` 이벤트만 신뢰하지 않고, 어떤 종료 이벤트도 오지 않는 경우까지 시간 제한으로 보호했다.

### 기능 단위 커밋

- `93810a6` `[Docs] : 카테고리 규칙 계약 추가`
- `1bc353d` `[Feat] : 카테고리 규칙 도메인 추가`
- `2326269` `[Feat] : 카테고리 규칙 로컬 저장 추가`
- `57e2057` `[Feat] : Import 카테고리 규칙 적용 추가`
- `dec1422` `[Feat] : Import 카테고리 검토 화면 추가`
- `5f2d097` `[Fix] : 카테고리 규칙 식별자 저장 방지`
- `8942b48` `[Test] : 카테고리 규칙 교체 원장 보존 검증`
- `9457203` `[Fix] : IndexedDB 업그레이드 대기 방지`
- `6166bb3` `[Fix] : IndexedDB 저장소 대기 제한 추가`

### 상태

`DONE`

## 2026-08-05 — Phase 4 Duplicate Candidate Review

### 작업 목적

새 Legacy XLS Preview가 이미 이 브라우저에 저장된 거래 또는 같은 Preview의 앞선 후보와 정확히 같을 가능성을 저장 전에 보여주고, 사용자가 직접 재포함 여부를 결정하게 한다. 기존 원장은 자동으로 삭제·병합·수정하지 않는다.

### 변경 내용

- 날짜, 금액, 통화, 방향, 유형, 정규화 설명으로 계산하는 메모리 전용 v1 비교 지문을 추가했다.
- 저장 거래와 Preview 내 앞선 후보의 일치 결과를 후보 인덱스와 안전한 참조 메타데이터로만 반환한다.
- 중복 가능 후보는 기본 저장 선택에서 제외하고, 후보별 체크와 전체 재포함을 제공한다.
- 선택된 후보만 원자 저장하며, 제외한 수를 `ImportBatch.skippedCount`와 `reviewedCount`에 반영한다.
- 비교 실패 시 저장을 비활성화하고, 원본 행·파일 이름을 노출하지 않는 안내를 제공한다.
- IndexedDB v1 스키마에는 지문·정규화 설명·새 인덱스를 저장하지 않는다.

### 검증 방법과 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm test` | PASS | 20 files, 251 tests |
| `npm run build` | PASS | Vite production build 성공 |
| Domain/Application/UI 테스트 | PASS | 정규화, 저장 거래·Preview 내 중복, 기본 제외, 개별·전체 재포함, skippedCount 검증 |
| 브라우저 수동 점검 | PASS | 로컬 빈 장부, 기간·정산·XLS 진입점 및 Phase 4 표기 확인; 개인 XLS를 열거나 저장하지 않음 |
| 개인정보 경계 | PASS | 실제 XLS·파일명·원본 행을 테스트와 로그에 사용하지 않음 |
| `git diff --check` | PASS | 최종 문서 커밋 전 재확인 예정 |

프로덕션 빌드는 기존 SheetJS 포함 JavaScript 청크가 500 kB를 넘는다는 경고만 출력했다. 동작 실패는 없으며, 코드 분할은 별도 성능 작업으로 남긴다.

### 리뷰에서 반영한 사항

- 비교 지문이 저장되거나 중복의 증명으로 해석되지 않도록 ADR과 저장 경계를 명시했다.
- 저장 거래 비교를 끝내지 못한 경우 후보를 전부 자동 저장하지 않고 재시도를 요구하도록 했다.
- UI 상단의 구현 Phase 표기를 `PHASE 4 · LOCAL`로 갱신했다.

### 기능 단위 커밋

- `d7f5870` `[Docs] : 중복 후보 검토 계약 추가`
- `565ef8c` `[Feat] : Import 중복 후보 감지 추가`
- `5552250` `[Feat] : Import 중복 후보 검토 화면 추가`
- `337a5f8` `[Fix] : 현재 개발 Phase 표기 갱신`

### 상태

`DONE`

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

## 2026-08-05 — Phase 3B Local Transaction Storage, Period View, and Shared-payment Settlement

### 작업 목적

Preview로 확인한 XLS 후보를 현재 브라우저에만 저장하고, 사용자가 하루·최근 1주·이번 달·직접 기간으로 거래를 볼 수 있게 한다. 단체 결제의 원결제와 받은 정산금을 수동 연결해 생활비에는 실제 순지출만 반영한다.

### 변경 내용

- Native IndexedDB v1의 `transactions`, `importBatches`, `budgetSettlements` 저장소와 `occurredOn` 범위 인덱스를 추가했다.
- ImportBatch와 Transaction 전체를 하나의 read-write transaction으로 저장해 중간 실패 시 부분 저장이 남지 않게 했다.
- 하루, 선택일 포함 최근 7일, 선택일의 달 전체, 직접 입력한 양끝 포함 날짜 범위를 구현했다.
- 원결제 출금 1건과 정산 입금 1건 이상을 명시적으로 연결하고, 생활비에는 `max(원결제 - 정산 입금 합계, 0)`만 원결제일에 귀속하도록 했다.
- 원본 거래, 입출금 합계, 잔액을 수정하지 않으며 자동 정산 매칭도 하지 않는다.
- Preview 화면에 명시적 로컬 저장 확인을 추가하고, 저장 거래·기간 제어·공동결제 정산 UI를 연결했다.

### 검증 방법과 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm run test` | PASS | 18 files, 243 tests |
| `npm run build` | PASS | Vite production build 성공; SheetJS 포함 번들 크기 경고만 존재 |
| IndexedDB 원자성 테스트 | PASS | 중복 key 실패 시 Batch와 Transaction 모두 rollback |
| 기간·정산 도메인 테스트 | PASS | 주·월 경계, 사용자 지정 범위, 다음 기간 입금, 과다 정산 0 하한 확인 |
| 브라우저 수동 점검 | PASS | 빈 장부, 직접 기간 입력, 공동결제 정산 UI 표시, 콘솔 error 0개 |
| private 데이터 경계 | PASS | 실제 private XLS를 저장하지 않았고, `samples/private/*`는 Git ignore이며 추적 파일 0개 |
| `git diff --check` | PASS | 공백 오류 0개 |

### 리뷰에서 반영한 사항

- 예전 Preview 전용 안내 문구를 저장 확인 흐름에 맞게 갱신했다.
- 기존 Mock/급여 화면 테스트와 충돌하지 않도록 로컬 장부의 상태 표기를 정리했다.
- 이미 정산에 사용한 거래는 새 정산 선택지에서 제외해 이중 반영을 막았다.

### 기능 단위 커밋

- `6f9b502` `[Docs] : 기간 조회와 단체 정산 계약 추가`
- `22452f4` `[Feat] : 기간 조회와 단체 정산 생활비 규칙 추가`
- `f76a7d6` `[Feat] : 로컬 거래 저장소와 Import 확정 추가`
- `3dd8edb` `[Feat] : 수동 단체 정산 저장 검증 추가`
- `b83ab4c` `[Feat] : 저장 거래 기간 조회와 공동결제 화면 제공`

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

## 2026-08-05 — Phase 3A Legacy XLS Import Preview

### 작업 목적

Git에서 제외된 계좌 거래·카드 이용 legacy XLS의 구조를 바탕으로, 원본을 저장하거나 자동 반영하지 않는 브라우저 메모리 Preview를 제공한다.

### 변경 파일

- Import Domain: `src/domain/imports/legacy-xls-preview.ts`
- XLS Infrastructure Reader: `src/infrastructure/imports/legacy-xls-file-reader.ts`
- Preview use case·UI: `src/application/imports/`, `src/ui/imports/`, `src/ui/dashboard/`, `src/app/`
- 계약·요구·계획: `docs/architecture/import-xls-contract.md`, `docs/product/requirements.md`, `docs/plans/current-plan.md`

### 구현 내용

- SheetJS `0.20.3`으로 사용자가 선택한 `.xls`의 첫 시트만 브라우저 메모리에서 읽는다.
- 계좌 거래는 날짜·설명·입금 또는 출금이 명확한 KRW 정수 행만 방향을 가진 `UNKNOWN` 후보로 만든다.
- 카드 이용은 원화 매입 행만 `EXPENSE + OUTFLOW` 후보로 만들고, 카드 라벨은 끝 4자리 또는 일반 `카드`로 축소한다.
- 취소·역분개, 외화 금액, 날짜·금액·설명 문제는 원본 값 없이 안전한 issue로 Preview하며 자동 반영하지 않는다.
- UI는 처리 상태, 후보·문제 수, 일부 후보와 지우기 동작만 제공한다. 파일명·Blob·전체 원본 행·Preview 상태의 저장과 확정 저장은 구현하지 않았다.
- UI는 Application use case를 통해 Preview reader를 호출하고, SheetJS 세부 구현은 Infrastructure에 국한했다.

### 검증 방법과 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| private XLS 구조 분석 | PASS | 파일명·값을 출력하지 않고 레이아웃 호환성만 확인 |
| `npm run lint` | PASS | warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm run test` | PASS | 12 files, 219 tests |
| `npm run build` | PASS | Vite production build 성공; SheetJS 포함 번들 크기 경고만 존재 |
| UI Component 흐름 | PASS | 파일명 비노출, 오류 일반화, Preview 지우기 |
| 개인정보·Git 검사 | PASS | private 샘플은 Git 미추적, 원본 값·파일명 로그 없음 |
| 실제 브라우저 XLS 선택 | PASS | 계좌 거래·카드 이용 XLS를 로컬 Preview로 확인, 파일명·거래 값은 검증 출력에 남기지 않음 |
| `git diff --check` | PASS | 공백 오류 0개 |

### Review에서 발견하고 반영한 문제

- Presentation UI가 XLS Infrastructure reader를 직접 부르던 결합을 Application의 `LegacyXlsPreviewReader` port와 App composition 연결로 분리했다.
- 카드 취소·외화·소수 금액은 실제 지출 후보로 만들지 않고 확인 필요 issue로 분리했다.
- File input의 값을 즉시 비워 민감할 수 있는 파일명이 UI 상태에 남지 않도록 했다.

### 남은 TODO

- Phase 3B에서 사용자 확인 후보의 Native IndexedDB 원자 저장을 구현한다.

### 기능 단위 커밋

- `6fe0d8c` `[Docs] : Legacy XLS Import 계약 확정`
- `c173b0d` `[Build] : 브라우저 XLS 파서 의존성 추가`
- `781d111` `[Feat] : Legacy XLS 거래 Preview 정규화 추가`
- `1edf6d8` `[Feat] : Legacy XLS 미리보기 화면 제공`

### 상태

`DONE`
