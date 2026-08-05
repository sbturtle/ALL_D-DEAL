# ADR-0010 — Kakao 장소 검색은 Web SDK와 후보별 명시적 요청으로 제한한다

- Status: Accepted
- Date: 2026-08-05

## Context

거래 설명의 상호·장소를 보조적으로 확인하면 카테고리 검토에 도움이 될 수 있다. 그러나 거래 설명은 개인 금융 기록의 일부이므로 외부 제공자에 자동 전송하면 local-first 경계가 약화된다. 브라우저에 노출되는 Vite 환경변수에는 REST 또는 Admin 자격증명을 둘 수 없다.

Kakao Map은 웹 지도 SDK에 JavaScript 키를 사용하며, JavaScript SDK 도메인 등록을 요구한다. 장소 검색은 Web SDK의 services 라이브러리로 제공할 수 있다.

## Decision

초기 연동은 Kakao Map Web (JavaScript) SDK만 사용하며, 환경변수 이름은 `VITE_KAKAO_MAP_JAVASCRIPT_KEY`로 고정한다. 이 값은 브라우저에 노출되는 키이므로 Kakao Developers에서 로컬·배포 JavaScript SDK 도메인으로 제한한다.

REST API key, Admin key, client secret, access token은 `.env.example`, `.env`, 클라이언트 번들, URL, IndexedDB에 넣지 않는다. 이후 장소 검색은 한 Import 후보에 대해 사용자가 누른 경우에만 실행하고, 전송 전 외부 전송 사실을 표시한다. 결과와 검색어는 Preview 메모리에만 두며 자동 분류·자동 저장·백그라운드 동기화에 사용하지 않는다.

## Consequences

- 키가 없거나 SDK 도메인이 등록되지 않은 환경에서도 기존 Import·장부 기능은 계속 동작한다.
- 사용자 동작 없이 거래 설명이 Kakao로 전송되지 않는다.
- 정확한 상호 매칭, 결과 선택 후 Merchant 저장, 카테고리 제안, REST 기반 서버 프록시, 다른 지도 제공자 비교는 별도 요구사항과 검증 후에만 추가한다.
