# Phase 7A — Explicit Kakao Place Search Boundary

- Status: `DONE`
- Plan updated: 2026-08-05
- Prerequisite: Phase 6B Account Transaction Type Classification `DONE`

## Goal

Prepare a safe, opt-in Kakao Map Web SDK boundary for future merchant/place lookup without sending financial data automatically or adding browser-side REST credentials.

## Scope and rules

- Use only `VITE_KAKAO_MAP_JAVASCRIPT_KEY` for the Kakao Map Web (JavaScript) SDK. It is a browser-visible platform key and must be restricted to the local and deployed JavaScript SDK domains registered in Kakao Developers.
- Never add a Kakao REST API key, Admin key, client secret, access token, or any financial value to Vite environment variables or client code.
- XLS 업로드 시 지출 후보 설명을 Kakao에 자동 전송해 장소를 분석한다. 업로드 전 화면에서 외부 전송 사실을 표시한다.
- Place responses, search terms, map state, raw source rows, and enrichment metadata are Preview-only unless a separate user-confirmed persistence design is accepted.
- Kakao place lookup is an optional aid for `EXPENSE` candidates. It must not replace transaction type classification, category confirmation, duplicate review, or local file import.

## User setup required before the next task

1. In Kakao Developers, enable Kakao Map API for the app.
2. Register the local development JavaScript SDK domain (normally `http://localhost:5173`) under the JavaScript key, plus the eventual deployment domain when applicable.
3. Copy `.env.example` to local `.env` and fill only `VITE_KAKAO_MAP_JAVASCRIPT_KEY`.
4. Do not commit `.env`; it is ignored by Git.

## Tasks

1. `DONE` Record the Web SDK-only decision and add a non-secret `.env.example` template.
2. `DONE` Add a lazily loaded Kakao Map SDK place-search adapter that fails safely when configuration, consent, SDK loading, or search availability is missing.
3. `DONE` Add a per-candidate Import Preview control with a clear external-transmission notice and no automatic request.
4. `DONE` Test disabled, unavailable, explicit-search, cancellation, and no-persistence behavior with fabricated descriptions only.
5. `DONE` Verify lint, typecheck, tests, build, private-data/Git boundaries, documentation, and function-sized local commits.

## Acceptance criteria

- The repository contains an empty, documented JavaScript-key variable only; no private key, REST/Admin key, or user financial data is tracked.
- The application remains fully usable without `.env` or without a Kakao key.
- XLS 업로드 시에만 지출 후보 장소 분석 요청이 시작되고, 업로드 전 외부 전송 사실을 명확히 표시한다.
- No request is made when configuration is missing, and no raw source row, search query, result, or key is written to IndexedDB, logs, URLs, tests, or commits.
