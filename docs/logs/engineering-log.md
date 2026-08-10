# 엔지니어링 로그

## 2026-08-07 — 9A단계 확인 후 로컬 장부 초기화

### 구현

- Settings에 별도 `로컬 장부 초기화` 영역을 추가했다. 거래 내역·Import 이력·공동결제 정산·정확/키워드 카테고리 규칙·월 생활비 목표가 영향을 받으며, 원본 Excel·샘플·앱 코드·환경 설정은 대상이 아님을 화면과 모달에 표시한다.
- 재확인 dialog는 Cancel·배경·Escape로는 저장소를 변경하지 않고 닫은 뒤 시작 버튼에 포커스를 돌려준다. 최종 버튼만 초기화를 실행하며, 실행 중에는 닫기와 중복 실행을 막는다.
- `BrowserLedgerRepository.resetLocalLedger`는 여섯 IndexedDB store를 한 read-write transaction으로 비운다. DB 스키마는 유지하고 실패하면 UI는 dialog를 유지한 채 일반화된 오류를 보여 준다.

### 검토와 검증

- Fake IndexedDB에 거래, Batch, 정산, 정확 규칙, 키워드 규칙, 목표를 채운 뒤 초기화하여 모든 store가 비었고 DB를 계속 읽을 수 있음을 검증했다.
- Settings UI는 범위 고지, Escape 취소와 포커스 복귀, 최종 확인 뒤 목표 입력 초기화, 저장소 실패 시 dialog·기존 목표 보존을 Testing Library로 검증했다.
- 실제 브라우저 시각 점검은 플랫폼 보안 정책이 로컬 `127.0.0.1` 접근을 차단해 수행하지 못했다. 정책을 우회하지 않았고, 로컬 개발 서버 외의 대체 브라우저 자동화도 실행하지 않았다.
- private XLS, 실제 거래, 원본 파일은 열거나 업로드·저장·커밋하지 않았다.

| 검사 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | 경고 0개 |
| `npm run typecheck` | PASS | TypeScript 프로젝트 빌드 성공 |
| `npm test` | PASS | 43개 파일, 435개 테스트 |
| `npm run build` | PASS | 기존 500 kB 초과 Vite 청크 경고만 존재 |
| 컴포넌트 사용자 흐름 | PASS | 취소·Escape·확인·실패·포커스 복귀 |
| 브라우저 시각 점검 | 미실행 | 플랫폼 보안 정책이 로컬 브라우저 접근을 거부함 |
| 개인정보 점검 | PASS | private 데이터와 샘플을 열거나 쓰거나 커밋하지 않음 |

### 기능 단위 커밋

- `5bbd074` `[Docs] : Phase 9A 로컬 장부 초기화 계획 추가`
- `344bc68` `[Feat] : 로컬 장부 전체 초기화 저장소 추가`
- `be55e74` `[Feat] : 설정에 로컬 장부 초기화 확인 추가`

### 상태

`NEEDS_USER_INPUT` — 구현과 자동 검증은 완료했지만 플랫폼 실행 한도로 문서의 최종 Git 커밋과 점검용 개발 서버 종료 권한이 거절되었다.

## 2026-08-07 — 8F단계 사용자 확인형 키워드 카테고리 묶기

### 구현

- 정확 설명 `CategoryRule`을 유지하고 별도 `KeywordCategoryRule`을 추가했다. 키워드는 NFKC·대소문자·공백·기호 차이를 정규화한 포함 비교이며, 두 글자 미만·80자 초과·긴 숫자 식별자 형태는 거절한다.
- `네이버페이`, `오더`, `쿠팡`은 현재 거래 설명에 실제로 포함될 때만 선택 가능한 추천 칩으로 제공한다. 어떤 추천도 자동 저장·자동 분류하지 않으며 사용자는 직접 입력하거나 취소할 수 있다.
- Import Preview는 정확 규칙을 먼저 적용한 뒤 가장 긴 일치 키워드 규칙을 적용하고, 같은 길이는 사전순으로 안정적으로 결정한다. 아직 해결되지 않은 지출만 기존 Merchant/Kakao fallback으로 넘어가며 Preview 카테고리는 계속 수정 가능하다.
- Browser IndexedDB를 v4로 올려 `keywordCategoryRules`를 독립 저장소로 추가했다. v1–v3의 거래·Batch·정산·정확 규칙·설정을 보존하고, 키워드 규칙 저장과 현재 미분류 일치 지출의 갱신은 한 read-write 트랜잭션으로 처리한다.
- Review에 키워드·카테고리·실제 일치 건수를 확인하는 mobile dialog를 추가했다. 일치한 미분류 `EXPENSE`만 변경하고 이미 분류한 거래는 건드리지 않으며, 이후 예외 수정은 기존 Transactions 편집 흐름을 사용한다.

### 검토와 검증

- Domain은 공백/기호 차이, 긴 키워드 우선, 사전순 tie-break, 안전하지 않은 키워드 거절, 사용자에게 보이는 추천어만 검증했다.
- Application은 원장 필드 보존, 이미 분류된 거래·수입 제외, 일치 없음, 저장 실패를 가짜 Transaction fixture로 검증했다.
- Storage는 v1·v2·v3 업그레이드와 키워드 규칙·거래 교체의 원자 저장을 fake IndexedDB로 검증했다. Import와 Review UI는 키워드 우선순위, 사용자 선택, Escape 포커스 복귀, 저장 후 완료 상태를 검증했다.
- 360px 실제 브라우저에서 빈 `/review`는 문서 폭 360px으로 가로 넘침이 없었고 링크·하단 메뉴는 44px 이상이었다. 저장소 주입이 허용되지 않아 묶기 dialog의 데이터 동작은 가짜 UI fixture로만 검증했으며, 어떤 private XLS·실제 거래도 열거나 쓰지 않았다.

| 검사 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | 경고 0개 |
| `npm run typecheck` | PASS | TypeScript 프로젝트 빌드 성공 |
| `npm test` | PASS | 43개 파일, 431개 테스트 |
| `npm run build` | PASS | 기존 500 kB 초과 Vite 청크 경고만 존재 |
| 반응형 브라우저 점검 | PASS | 360px 빈 `/review`, 가로 넘침 없음, 주요 조작 44px 이상 |
| 개인정보 점검 | PASS | private XLS와 실제 금융 데이터를 열거나 업로드·저장·커밋하지 않음 |

### 기능 단위 커밋

- `13f240e` `[Docs] : Phase 8F 키워드 묶기 계획 추가`
- `26d52c1` `[Feat] : 키워드 카테고리 규칙 저장 추가`
- `06e822a` `[Feat] : 포함 키워드 규칙을 Import에 적용`
- `61e4fa9` `[Feat] : 키워드 거래 묶기 사용 사례 추가`
- `06f6ef5` `[Feat] : 검토 화면에 키워드 묶기 추가`

### 상태

`DONE`

## 2026-08-07 — 8E단계 분류 검토 큐와 거래 방향 색상

### 구현

- `src/domain/transactions/review-needed.ts`에 공통 검토 판정을 추가했다. `UNKNOWN`과 카테고리 없는 `EXPENSE`는 모두 검토 필요로 집계하지만, 카테고리 큐에는 후자만 넣어 유형 검토를 카테고리 선택으로 숨기지 않는다.
- Home 검토 요약과 Transactions 검토 필터에서 여는 canonical `/review` 경로를 추가했다. 하단 탐색은 네 항목으로 유지하며, Route 제목과 화면 포커스 동작은 기존 History API 셸을 따른다.
- Review 화면은 Browser IndexedDB의 실제 미분류 지출을 오래된 순으로 하나씩 표시한다. 카테고리 버튼을 누르면 기존 단일 Transaction 수정 use case로 해당 건만 저장하고 다음 건으로 진행한다. 금액·일자·방향·유형·Import 추적정보·규칙은 변경하지 않는다.
- 로딩, 저장 중 오류, 저장소 읽기 오류 재시도, 건너뛰기, 빈 큐 완료, `UNKNOWN` 유형 검토 안내를 제공한다. 큐 건수·진행률·금액에는 mock 값을 사용하지 않는다.
- Home, 실제 Transactions, 명시적 Mock Transactions의 거래 행에 공통 방향 클래스를 적용했다. 수입은 민트, 지출은 로즈 카드와 대비되는 금액·아이콘을 쓰되 `+`·`−` 부호를 함께 유지한다.

### 검토와 검증

- Domain 규칙은 `UNKNOWN`이 카테고리를 가져도 유형 검토로 남고, 미분류 지출만 분류 큐로 들어가는 경우를 검증했다.
- Review UI는 한 건 저장 뒤 자동 다음 건 이동과 필드 보존, 유형 검토 분리, 저장소 재시도, 저장 실패 후 현재 건 유지까지 가짜 Transaction fixture로 검증했다.
- 360px 실제 브라우저에서 `/review` 빈 상태와 명시적 Mock Transactions를 확인했다. 문서 폭은 345px로 viewport 360px 안에 머물렀고, 행 높이는 96px였다. 수입은 `rgb(234, 247, 241)`, 지출은 `rgb(255, 240, 240)` 배경으로 렌더링됐다.
- private XLS·거래 샘플을 열거나 업로드하지 않았고, 외부 자산·백엔드·원격 분석은 추가하지 않았다.

| 검사 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | 경고 0개 |
| `npm run typecheck` | PASS | TypeScript 프로젝트 빌드 성공 |
| `npm test` | PASS | 41개 파일, 419개 테스트 |
| 반응형 브라우저 점검 | PASS | 360px `/review`·Transactions, 가로 넘침 없음 |
| 개인정보 점검 | PASS | private XLS를 열거나 커밋하지 않음 |

### 기능 단위 커밋

- `856261c` `[Docs] : Phase 8E 분류 검토 큐 계획 추가`
- `461e3ce` `[Refactor] : 거래 검토 판정 규칙 공통화`
- `b44520b` `[Feat] : 분류 검토 전용 큐 추가`
- `53ff5df` `[Style] : 거래 수입과 지출 색상 구분`

### 상태

`DONE`

## 2026-08-07 — 8D단계 모바일 앱 UI/UX 개편

### 구현

- `DESIGN.md`와 사용자 제공 다섯 화면을 기준으로 인디고·민트 토큰, 모바일 카드, inline SVG 아이콘, sticky app bar, 4개 항목 하단 탐색을 적용했다. 외부 디자인 CDN·폰트·이미지는 추가하지 않았다.
- `/home`과 `/transactions`를 분리하고 `/`는 Home, `/ledger`는 Transactions 호환 alias로 유지했다. Home은 실제 로컬 월 요약·목표·검토 수·7일 소비·최근 거래만 보여준다.
- Transactions는 일·주·월·직접 기간, 명시적 Mock 모드, 유형 필터, 거래별 메모·카테고리 수정, 공동결제 정산을 유지했다. 거래 수정은 접근 가능한 modal sheet로 바꿨다.
- Import는 파일 읽기·Kakao 분석·저장의 실제 상태, 실제 신규·중복·검토 수, 모바일 후보 카드와 카테고리 sheet, sticky 저장 행동을 제공한다. 사용자 규칙 동의와 접힌 분석 trace는 기존 계약을 유지한다.
- Payroll은 입력 요약, 월 실수령 hero, 공제 상세·주의·정책 근거 순서로, Settings는 현재 목표와 한 개의 로컬 목표 입력 중심으로 재구성했다. 계산·검증·포커스·메모리 전용 및 설정 저장 생명주기는 바꾸지 않았다.

### Review와 브라우저 검증

- 390px Import에서 기존 소개 영역 grid가 남아 제목과 설명이 두 열로 갈리는 문제를 단일 열 reset으로 수정했다.
- 360px Payroll에서 전역 FAB가 입력 모드 조작을 가리는 문제를 발견해 FAB를 Home과 Transactions에서만 표시하도록 제한하고 회귀 테스트를 추가했다.
- Home과 Transactions의 확인 필요 판정을 Import 계약과 같은 `UNKNOWN` 또는 카테고리 없는 `EXPENSE`로 통일했다. 카테고리가 필요 없는 수입·이체는 실제 검토 수와 필터에서 제외한다.
- Import 저장 요청에 세대 가드를 두고 저장 중 초기화와 Kakao 분석 중 확정을 차단했다. 중복 조회 실패 수치는 미확정으로 표시하고, 카테고리 sheet에는 현재 거래처·일자·금액·결제수단 맥락을 연결했다.
- 360, 390, 430, 768, 1280px에서 가로 넘침, 44px 미만 주요 조작, 콘솔 오류가 없음을 확인했다. 빠른 작업 sheet는 첫 항목 포커스, Escape 닫기, FAB 포커스 복귀를 확인했다.
- 브라우저 검증에는 빈 로컬 저장소와 임시 메모리 급여 값만 사용했으며 `samples/private/` 파일은 열거나 업로드하지 않았다.

| Check | Result | Note |
| --- | --- | --- |
| `npm run lint` | PASS | warnings 0 |
| `npm run typecheck` | PASS | TypeScript project build |
| `npm test` | PASS | 39 files, 410 tests |
| `npm run build` | PASS | existing >500 kB Vite chunk warning only |
| Responsive browser check | PASS | 360, 390, 430, 768, 1280px; console errors 0 |
| Privacy review | PASS | private XLS not opened; no external asset request added |

### 기능 단위 커밋

- `63712c0` `[Docs] : Phase 8D 모바일 UI 개편 계획 추가`
- `61a546d` `[Feat] : 모바일 홈과 거래 화면 분리`
- `a106d8d` `[Feat] : 불러오기 검토 UX 개편`
- `2d5f651` `[Style] : 급여와 목표 설정 화면 개편`
- `afc4004` `[Fix] : 집중 화면의 모바일 겹침 해소`
- `d686285` `[Fix] : 확인 필요 거래 판정 정정`
- `92c9375` `[Fix] : 불러오기 저장 상태 충돌 방지`

### 상태

`DONE`

## 2026-08-07 — 8C단계 결정적 가맹점 이름 해석

### 문제와 기존 기준선

Phase 7B는 정확 사용자 `CategoryRule`이 없는 카드 지출 설명을 Kakao에 한 번 검색하고, 정규화한 원문과 장소명이 정확히 같을 때만 `category_name`을 제안했다. 별도 Merchant Normalizer·Alias·Fuzzy·Cache는 없어서 카드사의 한글 발음 브랜드와 Kakao 영문 브랜드가 같은 Entity여도 검색과 장소 동일성 판정이 실패했다.

### 구현

- 원문을 보존하는 Unicode NFKC·기호·공백 Merchant Normalizer와 중앙 Alias Registry를 추가했다. GS25, CU, 7-ELEVEN, 메가MGC커피의 확인된 Alias만 처리하고 지점명을 canonical query에 유지한다.
- Exact·Alias 뒤에만 동작하는 의존성 없는 Fuzzy matcher를 추가했다. 길이 6 이상 Alias, 편집 거리 1 이하, 유사도 0.82 이상, 차점과 0.05 이상 차이인 단일 승자만 `MEDIUM`으로 인정한다.
- 기존 정확 `CategoryRule`을 최우선으로 유지했다. 일치 규칙은 Merchant 해석과 Kakao를 모두 건너뛰고, 사용자의 한 번 수정으로 넓은 Alias를 자동 학습하지 않는다.
- `PAYCO오더`, 네이버페이, 카카오페이, 토스페이, KG이니시스는 정규화 comparison key로 Alias·Fuzzy 전에 차단한다. 구두점과 전각 변형도 Kakao 호출 없이 Review로 남는다.
- Kakao Application use case가 원문·정규화·canonical query를 중복 제거해 후보별 최대 3회 순차 검색하고 분류 가능한 결과에서 멈춘다. 장소의 `category_name`이 매핑되고 정확 또는 안전한 canonical 동일성이 확인될 때만 제안한다.
- Import Preview는 original, normalized, 해석 출처, Alias, canonical query, 시도별 결과, Kakao 장소·카테고리와 최종 Review 이유를 기본적으로 접힌 상세 정보로 보여준다. 새 파일·지우기 시 기존 request를 무효화해 이미 시작한 SDK callback 뒤의 fallback·상태 반영을 중단하고, 한 파일의 동시 후보 분석을 3개 worker로 제한한다.
- 화면에 상호명 검색어의 Kakao 전송 범위를 명시하고 `PHASE 8C`로 갱신했다. 390px 점검에서 발견한 큰 제목 잘림은 360px에서도 안전하게 줄바꿈하도록 보완했다.

### 가짜 Fixture 측정

실제 금융 데이터나 실제 Kakao 응답을 사용하지 않은 Fabricated Merchant Fixture v1 14건의 결과다.

| Measurement | Result |
| --- | --- |
| Resolution source | EXACT 4, ALIAS 7, FUZZY 1, USER_RULE 1, REVIEW 1 |
| Phase 7B baseline classifier | KAKAO 4, USER_RULE 1, REVIEW 9 |
| Phase 8C classifier with supplied fabricated place | KAKAO 12, USER_RULE 1, REVIEW 1 |

`4 → 12`는 각 fixture에 기대 가짜 장소 결과를 미리 공급한 classifier 비교다. 실제 Kakao 검색 성공률, private sample 분류율 또는 production 정확도가 아니다.

### 검토와 검증

- 독립 코드 리뷰에서 발견된 결제 중개자 punctuation 우회와 무제한 후보 동시 실행을 각각 정규화 차단과 3-worker queue로 수정했다.
- 저장된 GS25 사용자 규칙의 Kakao 0회, Fuzzy → canonical → `MEDIUM`, PAYCO 변형 0회, raw/normalized/canonical 최대 3회를 통합 테스트로 보강했다.
- 후속 독립 코드·테스트 리뷰는 blocking/high 이슈가 없음을 확인했다.

| Check | Result | Note |
| --- | --- | --- |
| `npm run lint` | PASS | warnings 0 |
| `npm run typecheck` | PASS | TypeScript project build |
| `npm test` | PASS | 37 files, 384 tests |
| `npm run build` | PASS | existing >500 kB Vite chunk warning only |
| Responsive browser check | PASS | desktop, 390px, 360px `/imports`; console errors 0 |
| Privacy review | PASS | private XLS를 브라우저 검증·fixture·문서에 사용하지 않고 Kakao 전송 범위를 화면에 명시 |

### 기능 단위 커밋

- `d2e11dd` `[Docs] : Phase 8C Merchant Resolution 계획 추가`
- `92765de` `[Feat] : Merchant 정규화와 Alias 해석 추가`
- `7b66417` `[Feat] : Canonical Merchant Kakao 검색 전략 추가`
- `9ec68cb` `[Feat] : Import Preview Merchant 분석 과정 표시`
- `71d3236` `[Test] : Merchant Resolution Fixture 전후 측정 추가`
- `b62bf22` `[Fix] : 결제 중개자 변형의 외부 전송 차단`
- `21ae968` `[Test] : Merchant 분류 우선순위 통합 검증 강화`
- `53ee648` `[Fix] : Kakao 후보 분석 동시 실행 수 제한`
- `d499d3a` `[Fix] : Merchant 분석 상세 터치 영역 보완`
- `4ab4403` `[Fix] : Import 화면 Phase와 모바일 가독성 보완`

### 상태

`DONE`

## 2026-08-05 — 8B단계 로컬 월 생활비 목표

- Added a validated `LocalUserSettings` singleton for one positive KRW monthly goal and a pure remaining/exceeded calculation. The record contains no transaction, payroll, account, or Kakao data.
- Upgraded `household-ledger` IndexedDB from schema v2 to v3 with a `userSettings` store. Existing transactions, settlements, import batches, and category rules remain intact; the migration is covered by fabricated data tests.
- Added `/settings` with local-only load, save, clear, retry, and error feedback. A missing goal remains unset rather than receiving a default amount.
- The saved ledger now shows a monthly goal card using the existing shared-payment net living-expense summary. Day, week, and custom views intentionally do not allocate a monthly goal proportionally.
- Updated the navigation phase label to `PHASE 8B · LOCAL` and visually checked the new settings page at desktop and 360px widths without entering any financial value.

### 검증

| Check | Result | Note |
| --- | --- | --- |
| `npm run lint` | PASS | warnings 0 |
| `npm run typecheck` | PASS | strict TypeScript build |
| `npm test` | PASS | 33 files, 345 tests |
| `npm run build` | PASS | existing >500 kB Vite chunk warning only |
| IndexedDB v2 migration | PASS | fabricated transactions and category rules preserved |
| Responsive visual check | PASS | desktop and 360px Settings layouts |

### 기능 단위 커밋

- `2440042` `[Docs] : Phase 8B 생활비 목표 계획 추가`
- `99f3e12` `[Feat] : 월 생활비 목표 로컬 저장 추가`
- `c715fbd` `[Feat] : 월 생활비 목표 설정과 장부 잔액 표시`
- `158463c` `[Test] : IndexedDB v3 마이그레이션 보존 범위 강화`

## 2026-08-05 — 8A단계 저장 거래 메모와 카테고리

- Added a validated single-Transaction update flow that preserves amount, date, type, and Import trace fields while replacing only category, memo, and `updatedAt` in local IndexedDB.
- Added inline ledger controls to edit or clear a category and optional memo, with local error feedback and immediate list refresh after a successful write.
- Added fixed Unicode emoji presentations for every internal category; no external icon asset or network request is used.
- Verified with fabricated application, IndexedDB, category-presentation, and UI fixtures plus lint, typecheck, tests, and production build.

## 2026-08-05 — 7C단계 Kakao 분석 진행 표시

- Import Preview now counts candidates whose Kakao place lookup is `SEARCHING` and shows a sticky spinner with the pending count.
- The notice is announced with `role="status"`, does not block Preview review, and disappears once all pending lookups settle.
- Verified with a deferred fabricated lookup fixture, `npm run lint`, `npm run typecheck`, `npm test` (27 files, 316 tests), and `npm run build`.

## 2026-08-05 — 7B단계 Kakao 카테고리 보강

### 문제와 원인

Kakao 연동은 REST 주소 검색이 아니라 JavaScript SDK의 키워드 장소 검색을 이미 사용하고 있었다. 다만 `category_name`을 일반 문자열로만 받아 Preview에서 상호·주소와 함께 출력했고, 내부 `CategoryId`로 매핑하거나 매칭 신뢰도를 판단하지 않았다. 카테고리 그룹과 좌표도 내부 DTO에서 버려져 주소 수집처럼 보였다.

### 변경 내용

- 키워드 장소 DTO에 장소명, `category_name`, 카테고리 그룹, 지번·도로명 주소, 좌표를 보존했다.
- 제한된 `category_name` 매퍼와 정확한 정규화 상호명 일치 규칙을 추가해, 일치한 미분류 `EXPENSE`에만 `KAKAO_LOCAL · HIGH` 카테고리를 제안한다.
- 사용자 규칙이 이미 적용된 후보는 Kakao에 전송하지 않고 `USER_RULE · HIGH`로 표시한다. PAYCO 오더·네이버페이·카카오페이·토스페이·KG이니시스 표식도 전송하지 않고 검토로 둔다.
- 불일치·미매핑 결과는 검토로 두며, Preview에는 Kakao 카테고리·그룹·주소와 제안 출처·신뢰도를 표시한다. Kakao 메타데이터와 원본 응답은 저장하지 않는다.

### 검증

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm test` | PASS | 27 files, 315 tests |
| Fabricated Kakao fixtures | PASS | 카페, 빈 카테고리 그룹, 상호 불일치, 미매핑, 결제 중개자 제외, 사용자 규칙 우선 |

### 상태

`DONE`

## 2026-08-05 — 7A단계 명시적 Kakao 장소 검색

### 작업 목적

지출 후보의 상호·장소 확인을 보조하되, 거래 설명이 외부 Kakao로 자동 전송되거나 장소 검색 결과가 로컬 장부에 저장되지 않도록 한다.

### 변경 내용

- 빈 `VITE_KAKAO_MAP_JAVASCRIPT_KEY`만 담은 `.env.example`을 추가했다. REST/Admin 키, client secret, 토큰은 브라우저 환경변수에 넣지 않는다.
- Kakao Map Web SDK는 환경변수에 JavaScript 키가 있을 때만 준비하고, 사용자가 검색 버튼을 누른 시점에만 `services` 라이브러리를 지연 로드한다.
- Import Preview의 `EXPENSE` 후보마다 외부 전송 안내와 `Kakao 장소 검색` 버튼을 제공한다. 검색 전에는 SDK와 장소 검색을 호출하지 않는다.
- 결과는 후보별 Preview 메모리에만 표시하며, IndexedDB·Transaction·CategoryRule·URL·로그에 저장하지 않는다. 키가 없거나 SDK 요청이 실패하면 기존 Import 흐름은 계속 사용할 수 있다.

### 검증 방법과 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm test` | PASS | 25 files, 302 tests |
| `npm run build` | PASS | Vite production build 성공 |
| SDK/UI 테스트 | PASS | 빈 검색어는 SDK 미호출, 지출 후보의 명시적 클릭 전 검색 미호출, 결과 Preview 전용 표시 검증 |
| 개인정보 경계 | PASS | `.env`를 읽거나 출력하지 않았고, 실제 거래 설명·키·검색 결과를 테스트·문서·커밋에 사용하지 않음 |

프로덕션 빌드는 기존 SheetJS 포함 JavaScript 청크가 500 kB를 넘는다는 경고만 출력했다. Kakao SDK는 런타임 사용자 요청 시에만 외부에서 로드한다.

### 기능 단위 커밋

- `6fb4095` `[Docs] : Kakao Map Web SDK 환경 설정 추가`
- `93f3541` `[Feat] : Kakao 장소 검색 어댑터 추가`
- `9a4cf2e` `[Feat] : Import 후보별 Kakao 장소 검색 추가`

### 상태

`DONE`

## 2026-08-05 — 6B단계 계좌 거래 유형 분류

### 작업 목적

카드 이용내역을 소비 지출의 우선 출처로 유지하고, 계좌 거래를 카테고리보다 먼저 현금흐름 유형으로 분류한다. 카드대금·저축·대출상환·투자·이체·수입·리워드를 일반 지출로 잘못 처리하지 않으며, 분류 근거를 저장 전 Preview에서만 설명한다.

### 변경 내용

- `SELF_TRANSFER`, `REWARD`를 Transaction 유형 어휘에 추가했다. `SELF_TRANSFER`는 본인 계좌 별칭이 없으므로 자동 분류하지 않는다.
- 작은 순수 계좌 규칙 엔진이 거래 방향과 설명의 명시적 표식으로 `CARD_PAYMENT`, `SAVING`, `LOAN_PAYMENT`, `INVESTMENT`, `TRANSFER`, `INCOME`, `REWARD`를 분류한다. 방향과 맞지 않거나 일치하지 않으면 `UNKNOWN / REVIEW`로 둔다.
- 계좌 XLS 후보는 `type`, `ACCOUNT_RULE_ENGINE`, 비식별 근거 코드, 확신 수준을 Preview 메타데이터로 받는다. 확정 저장에는 Transaction 유형만 남고 이 메타데이터는 저장하지 않는다.
- 카드 사용 XLS는 기존 `EXPENSE + OUTFLOW`를 유지한다. 카테고리 규칙·빠른 선택·향후 규칙 저장은 새 지출 후보에만 제공하며, 계좌 카드대금은 생활비에서 제외된다.
- Import 화면은 유형과 입출금, 계좌 규칙의 출처·확신·근거를 표시하고, 비지출 후보에는 카테고리 대신 제한 사유를 안내한다. Dashboard도 새 유형 라벨을 표시한다.

### 검증 방법과 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm test` | PASS | 24 files, 299 tests |
| `npm run build` | PASS | Vite production build 성공 |
| Domain/Application/UI 테스트 | PASS | 유형 규칙 우선순위·방향 제한·SELF_TRANSFER 보류·Preview 근거·확정 시 메타데이터 폐기·지출 전용 카테고리·카드대금 생활비 제외 검증 |
| 개인정보 경계 | PASS | 실제 XLS·파일명·원본 행·개인 식별값을 테스트·문서·커밋에 사용하지 않음 |
| 수동 브라우저 저장소 점검 | 미실행 | 기존 로컬 금융 데이터를 열지 않고 가짜 Preview 기반 UI 흐름 테스트로 대체 |

프로덕션 빌드는 기존 SheetJS 포함 JavaScript 청크가 500 kB를 넘는다는 경고만 출력했다. 동작 실패는 없으며, 코드 분할은 별도 성능 작업으로 남긴다.

### 리뷰에서 반영한 사항

- 계좌 유형 규칙은 범용 DSL이나 퍼지 매칭 대신 코드로 읽고 테스트할 수 있는 명시적 키워드와 방향 조건으로 제한했다.
- 분류 결과의 원문이나 식별자를 새 저장 필드로 만들지 않고, 비식별 근거 코드와 확신 수준만 Preview에 유지했다.
- 기존에 저장된 카테고리 데이터는 마이그레이션하거나 무효화하지 않았다. 새 Preview부터만 지출 유형에 카테고리를 적용한다.
- Kakao 등 외부 API, 브라우저 REST 인증, 계좌 별칭, 상호·브랜드 매핑, 확장 카테고리는 후속 계획으로 유지했다.

### 기능 단위 커밋

- `9e89603` `[Docs] : 계좌 거래 유형 분류 계약 추가`
- `4601645` `[Feat] : 계좌 거래 유형 규칙 엔진 추가`
- `a970967` `[Feat] : 계좌 XLS 유형 분류를 Preview에 반영`
- `66e59e8` `[Feat] : Import 분류 근거와 지출 카테고리를 분리`

### 상태

`DONE`

## 2026-08-05 — 6A단계 작업 페이지와 카테고리 검토 UX

### 작업 목적

한 화면에 섞여 있던 급여 계산, 기간 장부, XLS Import 검토를 목적별 페이지로 분리한다. Import 후보의 카테고리도 좁은 화면에서 빠르게 선택하고, 이번 거래의 분류와 다음 거래를 위한 규칙 동의를 혼동하지 않게 한다.

### 변경 내용

- `/ledger`, `/imports`, `/payroll` 경로와 `/`의 장부 해석을 추가했다. 상단 탐색은 현재 페이지를 표시하고 History API·`popstate`로 브라우저 뒤로/앞으로를 반영한다.
- Ledger에서 Import Preview를 분리해 장부에는 기간 조회와 수동 공동결제 정산만, Import에는 파일 선택·중복 검토·카테고리 확인만 보이게 했다. 급여 계산은 별도 메모리 전용 화면이다.
- 모바일에서도 상단 작업 탐색을 숨기지 않고 가로 스크롤 가능한 현재 페이지 탭으로 표시했다.
- 후보별 native select를 현재 카테고리 버튼과 10개 빠른 선택 버튼(미분류 포함)으로 교체했다. 한 번에 한 후보의 선택판만 열리며 선택하면 바로 닫힌다.
- “이 설명을 다음에도 기억” 체크는 카테고리 선택과 분리했다. 카테고리를 미분류로 되돌리면 규칙 동의도 해제되고, 기본 제외된 중복 후보는 재선택 전까지 규칙을 만들 수 없다.

### 검증 방법과 결과

| 검증 | 결과 | 비고 |
| --- | --- | --- |
| `npm run lint` | PASS | warning 0개 |
| `npm run typecheck` | PASS | TypeScript project build 성공 |
| `npm test` | PASS | 23 files, 280 tests |
| `npm run build` | PASS | Vite production build 성공 |
| 경로·UI 테스트 | PASS | 기본 장부·직접 경로·상단 탐색·`popstate`, 분리된 Import/Payroll, 빠른 선택·미분류 복귀·규칙 동의·중복 제외 검증 |
| 브라우저 수동 점검 | PASS | `/imports` 직접 진입, 데스크톱·390px 모바일 탐색 및 `/ledger` 전환 확인; 파일 선택·거래 저장·정산 변경은 수행하지 않음 |
| 개인정보 경계 | PASS | 실제 XLS·파일명·원본 행을 테스트·문서·커밋에 사용하지 않음 |
| `git diff --check` | PASS | 최종 문서 커밋 전 재확인 예정 |

프로덕션 빌드는 기존 SheetJS 포함 JavaScript 청크가 500 kB를 넘는다는 경고만 출력했다. 동작 실패는 없으며, 코드 분할은 별도 성능 작업으로 남긴다.

### 리뷰에서 반영한 사항

- 모바일에서 페이지 탐색이 사라지면 분리된 화면에 도달하기 어려우므로 숨김 대신 터치 가능한 가로 탭으로 유지했다.
- 카테고리마다 항상 10개 버튼을 노출하지 않고, 현재 거래의 선택판 하나만 열어 Preview 밀도를 줄였다.
- 카테고리를 비우면 규칙 체크도 함께 해제해 미분류 규칙 요청이 남지 않게 했다.
- 전용 라우터 의존성은 중첩 경로·데이터 로더 같은 실제 요구가 생길 때까지 추가하지 않는다.

### 기능 단위 커밋

- `7c5317f` `[Docs] : Phase 6A 페이지 전환 계약 추가`
- `e38db06` `[Feat] : 작업 페이지 경로 모델 추가`
- `137d85d` `[Feat] : 금융 작업 화면을 경로별로 분리`
- `cd7d8cd` `[Feat] : Import 카테고리 빠른 선택 추가`

### 상태

`DONE`

## 2026-08-05 — 5단계 사용자 확인형 카테고리 규칙

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
