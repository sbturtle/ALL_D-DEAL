# Phase 9A — Confirmed Local Ledger Reset

- Status: `IN_PROGRESS`
- Plan updated: 2026-08-07
- Prerequisite: Phase 8F User-Confirmed Keyword Category Grouping `DONE`

## Goal

Let the user deliberately reset the current browser's local household-ledger data from Settings, with a clear, accessible reconfirmation step.

## Scope and decisions

1. The Settings page will expose a visually separate local-ledger reset area and describe its scope before the user opens the dialog.
2. Reset is unavailable without an explicit final confirmation. Cancel, backdrop dismissal, and Escape must not change stored data.
3. One IndexedDB read-write transaction will clear transactions, import batches, budget settlements, exact category rules, keyword category rules, and local user settings while preserving the database schema.
4. The dialog must state that the operation is irreversible and affects this browser's local ledger only. It must not delete source Excel files, samples, application code, environment variables, or any remote data.
5. On storage failure, leave the dialog open with an actionable error; do not claim the reset completed.
6. Keep all data local-first. No remote service, analytics, or private-sample access is added.

## Completion criteria

1. Users can find and open the reset control in Settings at desktop and mobile widths.
2. The confirmation dialog clearly lists the affected local data and supports keyboard-safe cancellation.
3. Confirming clears every in-scope store atomically; repository and UI tests cover success, cancellation, and failure paths.
4. After a successful reset, Settings reflects the cleared monthly goal and communicates success.
5. Lint, typecheck, tests, build, focused browser review, documentation, engineering log, and functional-unit commits are complete.

## Vertical slices

### Slice 1 — Local storage reset operation

- Add and test a single transactional repository operation for clearing the local ledger stores.

### Slice 2 — Settings reset confirmation

- Add the settings danger area, focus-managed confirmation dialog, loading state, and safe error handling.

### Slice 3 — Verification and records

- Run automated and focused responsive checks; record the reset boundary and results in product, architecture, ADR, plan, and engineering log documents.
