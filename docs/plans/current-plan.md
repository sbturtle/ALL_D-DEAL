# Phase 7B — Kakao Category Enrichment

- Status: `DONE`
- Plan updated: 2026-08-05
- Prerequisite: Phase 7A Kakao place search `DONE`

## Goal

Turn Kakao keyword-place `category_name` into a safe suggested internal expense category in Import Preview; addresses remain supporting match information only.

## Rules

- Preserve Kakao keyword-place fields: id, name, category name/group, addresses, coordinates.
- Map only a small, tested subset of `category_name` to internal expense categories. Unmapped or ambiguous results require review.
- User-confirmed category rules always win. Kakao can fill only an unclassified `EXPENSE` Preview candidate.
- Use simple normalized merchant/place-name equality for HIGH confidence. Do not auto-categorize intermediary payment labels such as PAYCO, Naver Pay, Kakao Pay, Toss Pay, or KG Inicis.
- Display Kakao category, mapped internal category, source, confidence, and address in Preview; do not persist Kakao metadata or raw response.

## Completion

1. `DONE` Diagnose the address-focused implementation and record the actual SDK keyword-search flow and lost category mapping.
2. `DONE` Preserve Kakao category fields, add the category mapper and merchant-match guard, and connect the result to unclassified expense Preview candidates.
3. `DONE` Update Import Preview diagnostics and category UX without overriding user rules.
4. `DONE` Add fabricated fixtures for cafe, empty category group, address/category propagation, intermediary exclusion, priority, and ambiguous match review.
5. `DONE` Verify, document, and create function-sized local commits.
