# Phase 8C — Deterministic Merchant Name Resolution

- Status: `DONE`
- Plan updated: 2026-08-07
- Completed: 2026-08-07
- Archived: 2026-08-07
- Prerequisite: Phase 8B Local Monthly Living-Expense Goal `DONE`

## Goal

Improve Kakao-assisted category suggestions for Korean card merchant spelling variants without changing stored transactions or weakening the existing user-review boundary.

## Pipeline and priority

```text
Raw card merchant description
  → exact confirmed user category rule
  → payment-intermediary exclusion
  → Merchant normalization
  → centralized brand Alias resolution
  → bounded Fuzzy fallback over safe known candidates
  → Canonical Merchant
  → Kakao raw / normalized / canonical query attempts (at most three, deduplicated)
  → mapped category suggestion or review
```

Confirmed user rules remain the highest-priority category source and skip Kakao. `PAYCO오더`, 네이버페이, 카카오페이, 토스페이, and KG이니시스 remain unqueried and in review.

## Scope and decisions

1. Add framework-independent Merchant normalization that performs Unicode NFKC, whitespace and case normalization, conservative punctuation handling, and comparison-key generation without changing the original value.
2. Add a centralized alias registry for GS25, CU, 7-ELEVEN, and 메가MGC커피. Resolve only a leading brand alias and preserve the remaining branch name, for example `지에쓰이십오 대전법동점` → `GS25 대전법동점`.
3. Add a deterministic fuzzy fallback only after exact and alias resolution. Restrict candidates to the alias registry in this slice, require a conservative threshold and a unique best match, preserve branch text, and return ambiguous/unsafe values for review.
4. Do not add Fuse.js or another dependency unless the small deterministic matcher proves insufficient. Do not add vectors, embeddings, AI classification, backend services, cloud sync, or Android work.
5. Keep the current confirmed CategoryRule store as the user-learning mechanism. Do not create persistent Merchant aliases, a Merchant cache, or automatic aliases from Kakao results in this slice because those repositories do not yet exist and require a separate privacy/storage decision.
6. Search Kakao with a deduplicated sequence of the original, normalized display, and canonical Merchant values, stopping after a classified result and never exceeding three attempts. Kakao `category_name` remains the classification input; addresses remain verification-only metadata.
7. Expose an in-memory resolution trace in Preview for review: original, normalized, resolution source, canonical query, attempted queries, matched Kakao place/category, internal category, and final review reason. Never persist or log this trace.
8. Bind asynchronous fallback results to the active file-preview request so a cleared or replaced upload cannot receive stale Kakao results. Preserve the existing visible pending/failed states.
9. Use only clearly fabricated test fixtures. Measure the baseline and enhanced resolution outcomes with explicit `EXACT`, `ALIAS`, `FUZZY`, `KAKAO`, `USER_RULE`, and `REVIEW` labels; do not claim production-data accuracy.

## Acceptance criteria

1. `지에쓰이십오 대전법동점` resolves to `GS25 대전법동점`.
2. `지에스25 한남대점` resolves to `GS25 한남대점`.
3. `씨유 한남대점` resolves to `CU 한남대점`.
4. `메가엠지씨커피 대전법동점` resolves to `메가MGC커피 대전법동점`.
5. A pre-existing exact user CategoryRule for a GS25 description wins before fuzzy matching and Kakao, and no external lookup occurs.
6. `PAYCO오더` is neither alias-resolved nor fuzzy-matched, is not sent to Kakao, and remains in review.
7. Fuzzy matching runs only as a fallback, accepts one unambiguous high-similarity known brand, and sends low-confidence or tied candidates to review.
8. Kakao receives canonical Merchant queries through the bounded fallback strategy, and a canonical-equivalent Kakao place can provide a mapped category suggestion while the user retains final control.
9. Fabricated fixture measurement reports before/after source counts without using or exposing `samples/private/` values.
10. Targeted tests, lint, typecheck, full tests, production build, privacy review, documentation, and function-sized local commits pass before the Phase is marked `DONE`.

## Out of scope

- Persistent Merchant cache or user-managed alias storage
- Automatic alias learning from user edits or Kakao results
- Reclassification of already stored Transactions
- Vector search, embeddings, LLM classification, backend/API proxy, cloud sync, and Android implementation

## Completion evidence

- Required GS25, CU, 7-ELEVEN and 메가MGC커피 aliases resolve to canonical brands while preserving safe branch names.
- Exact stored CategoryRule wins end-to-end and produces zero Kakao calls. Payment-intermediary variants also produce zero calls and remain in review.
- Fuzzy matching is a registry-only fallback with bounded edit distance, threshold and winner margin. Canonical Kakao fallback is deduplicated and capped at three sequential attempts per candidate.
- Import Preview exposes a collapsed, memory-only resolution trace, invalidates stale upload results and further fallbacks after any in-flight SDK callback settles, and limits file-level candidate analysis to three workers.
- Fabricated Merchant Fixture v1 has 14 cases: resolution `EXACT 4 / ALIAS 7 / FUZZY 1 / USER_RULE 1 / REVIEW 1`; supplied-place classifier baseline `KAKAO 4 / USER_RULE 1 / REVIEW 9`; enhanced `KAKAO 12 / USER_RULE 1 / REVIEW 1`. These are not actual Kakao API or production accuracy measurements.
- Independent code and test reviews found no remaining blocking/high issue after intermediary punctuation guards, integration coverage and bounded concurrency were added.

## Final verification

| Check | Result |
| --- | --- |
| `npm run lint` | PASS, warnings 0 |
| `npm run typecheck` | PASS |
| `npm test` | PASS, 37 files / 384 tests |
| `npm run build` | PASS; existing >500 kB chunk warning only |
| Browser `/imports` | PASS at desktop, 390px and 360px; console errors 0 |
| Privacy | PASS; no private sample upload or fixture/document disclosure, and Kakao merchant-query boundary is visible before file selection |

## Documentation

- Requirements and Requirements History include FR-034, priority, privacy boundary and fixture limitations.
- [Merchant Resolution Contract](../architecture/merchant-resolution-contract.md) records normalization, aliases, Fuzzy thresholds, query strategy, trace and deferred storage.
- [ADR-0012](../adr/ADR-0012-merchant-entity-resolution-before-vector-search.md) records why Vector/Embedding remains deferred and when to revisit it.
- Engineering Log records implementation, review fixes, verification and function-sized commits.
