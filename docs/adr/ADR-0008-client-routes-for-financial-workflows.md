# ADR-0008 — 금융 작업 목적별 클라이언트 경로를 분리한다

- Status: Accepted
- Date: 2026-08-05
- Amended: 2026-08-07

## Context

급여 계산, 기간 장부 조회, XLS Import 검토를 하나의 긴 페이지에 배치하면 사용자가 현재 작업과 다음 행동을 파악하기 어렵다. 현재 앱은 React와 Vite만 사용하고 있으며, 라우터 라이브러리가 필요한 중첩 경로·권한·데이터 로더 요구는 없다.

## Decision

Phase 6A는 `/ledger`, `/imports`, `/payroll`을 고유 경로로 제공했고, Phase 8B는 개인 설정을 장부와 섞지 않기 위해 `/settings`을 추가했다. Phase 8D는 장부의 요약과 상세 관리를 분리해 `/home`과 `/transactions`를 canonical 경로로 사용한다. Phase 8E는 많은 미분류 지출을 장부 목록과 분리해 처리하도록 `/review` 보조 경로를 추가한다. `/`는 Home으로 해석하고 기존 `/ledger`는 Transactions로 연결하는 호환 alias로 유지한다. 알 수 없는 경로도 Home으로 안전하게 돌아온다.

앱은 가장 작은 자체 History API 라우터로 현재 경로와 `popstate`를 반영한다. 모바일 하단 탐색은 Home, Transactions, Payroll, Settings를 노출하고 현재 위치에 `aria-current="page"`를 표시한다. `/review`는 하단 탐색을 다섯 항목으로 늘리지 않고 Home의 검토 요약과 Transactions의 검토 필터에서 연다. 경로 변경 뒤에는 새 화면 본문으로 포커스를 옮긴다. Import는 고유 `/imports` 경로를 유지하며 Home과 Transactions의 빠른 작업 시트 첫 항목에서 진입한다. 빠른 작업 버튼은 집중 입력 화면을 가리지 않도록 Home과 Transactions에서만 표시하며, 시트는 Escape, 포커스 순환과 닫은 뒤 포커스 복귀를 지원한다.

각 화면은 필요한 UI만 렌더링한다. 급여 입력은 계속 메모리 전용이며, Import Preview·장부 저장소·카테고리 규칙의 local-first 경계는 바뀌지 않는다.

## Consequences

- 긴 단일 페이지와 해시 앵커 대신 작업 목적별 URL과 브라우저 뒤로/앞으로가 제공된다.
- Home의 요약과 Transactions의 기간 조회·편집은 서로 독립된 화면이지만 같은 local-first 조회와 계산 계약을 공유한다.
- 대량 카테고리 정리는 `/review`에서 한 건씩 처리하고, `UNKNOWN` 거래 유형 검토는 기존 Transactions 필터에 남긴다. 따라서 카테고리 선택이 유형 검토를 완료한 것처럼 보이지 않는다.
- 4개 핵심 화면은 엄지손가락으로 닿기 쉬운 하단 탐색에서 전환하고, 파일 Import는 기존 기능만 담은 빠른 작업 시트로 연다.
- 기존 `/ledger` 북마크는 계속 동작한다. 정적 배포 fallback에는 새 canonical 경로도 포함해야 한다.
- 현 단계에는 `react-router` 같은 추가 의존성이 필요하지 않다.
- 정적 배포 시 이 경로들을 앱 진입점으로 fallback하는 호스트 설정이 필요하다. 2026-09-29 Vercel 배포에서 `/home` 등 직접 접속이 404로 확인되어, 저장소 루트 `vercel.json`에 모든 경로를 `/index.html`로 보내는 rewrite를 추가했다. Vercel은 실제 정적 파일을 rewrite보다 먼저 제공하므로 번들·아이콘 요청은 영향을 받지 않는다.
- 중첩 경로, 로더, 인증, 서버 렌더링 요구가 생기면 전용 라우터를 다시 검토한다.
