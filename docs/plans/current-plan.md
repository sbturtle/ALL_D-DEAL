# Phase 4 — Duplicate Candidate Review

- Status: `IN_PROGRESS`
- Plan updated: 2026-08-05
- Prerequisite: Phase 3B Local Transaction Storage `DONE`

## Goal

Compare a new Legacy XLS Preview with transactions already saved on this browser. Make exact duplicate possibilities visible before confirmation, exclude those candidates from the default save set, and let the user include them deliberately. Never delete or merge existing records automatically.

## Scope and rules

- The Phase 4 fingerprint is a transient v1 comparison key calculated from `occurredOn`, `amountMinor`, `currency`, `direction`, `type`, and normalized `descriptionOriginal`.
- Description normalization uses Unicode compatibility normalization, lower case, trimmed/collapsed whitespace, and punctuation removal. Payment instrument is deliberately excluded so a repeated account transaction is still comparable when a label is absent.
- A fingerprint equality is only a **duplicate possibility**. Hash collisions, same-day repeated purchases, and different importer interpretations remain possible.
- Candidates matching a saved transaction or an earlier candidate in the same Preview are initially unchecked. All other valid candidates remain selected.
- The user can select an individual candidate or explicitly include all duplicate possibilities. Confirmation persists only the selected candidates; unselected count is recorded as `ImportBatch.skippedCount`.
- Fingerprints and normalized strings are not persisted in this slice; Native IndexedDB schema remains v1. This avoids adding a new local derivative of financial descriptions before a query-performance need is demonstrated.
- Original transactions, balances, import source files, names, and full identifiers remain unchanged and unstored.

## Out of scope

- Automatic deletion, merge, replacement, or deduplication of saved transactions.
- Fuzzy amount/date windows, machine-learned matching, cross-currency comparison, and automatic correction of transaction type.
- A persisted fingerprint index or migration; revisit only when local transaction volume makes transient comparison inadequate.

## Tasks

1. `DONE` Record duplicate-review requirements, fingerprint limits, and user-confirmation decision.
2. `IN_PROGRESS` Implement and test versioned v1 fingerprint normalization and saved/in-preview duplicate candidate detection.
3. `TODO` Add an application query that reads local saved transactions and returns only safe duplicate-match metadata for a Preview.
4. `TODO` Add Preview selection state, duplicate indicators, individual override, and explicit "include all" action before local confirmation.
5. `TODO` Record skipped candidate count in ImportBatch and verify only the selected candidates are stored.
6. `TODO` Run lint, typecheck, tests, build, browser smoke checks, privacy scans, review, documentation, and focused local commits.

## Acceptance criteria

- Same normalized v1 fingerprint creates a visible possible-duplicate signal; one differing core field does not.
- Candidate-vs-saved and repeated-candidate-in-same-Preview cases are both detected without source values appearing in errors or logs.
- A possible duplicate is not saved by default, but the user can include it explicitly before confirmation.
- Excluded candidates are absent from the atomic import and `skippedCount` equals their count.
- No existing transaction is modified or deleted, and no duplicate decision is made solely by the application.
- Tests use fabricated values only; private XLS files and data stay outside Git, logs, fixtures, and commits.
- Changes are verified and committed locally by independent function using `[Type] : title` plus a non-empty body; nothing is pushed.
