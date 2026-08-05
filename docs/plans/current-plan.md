# Phase 8B — Local Monthly Living-Expense Goal

- Status: `IN_PROGRESS`
- Plan updated: 2026-08-05
- Prerequisite: Phase 8A Saved Transaction Notes and Categories `DONE`

## Goal

Let the user set, change, or clear one monthly living-expense goal on this browser only, then show its used, remaining, or exceeded amount in the ledger's monthly view.

## Scope and decisions

1. Add a `/settings` page for the monthly goal rather than mixing configuration controls into the ledger.
2. Store at most one validated setting record in IndexedDB v3. The record contains no transaction, payroll, account, or Kakao data.
3. A goal is an optional positive KRW safe integer. There is no fabricated default goal. Clearing it removes the local record.
4. Monthly progress uses the existing `calculateLivingExpenseSummary` result, so manually linked shared payments remain net spending and the original cash-flow transactions remain unchanged.
5. Do not prorate a monthly goal for day, week, or custom ranges. Those views keep their actual spending summary and explain that the goal is available in the monthly view.
6. Keep the payroll calculator memory-only; never copy its inputs or results into Settings or IndexedDB.

## Completion

1. `TODO` Define and test the local monthly-goal model and progress calculation, including unset, remaining, and exceeded states.
2. `TODO` Add validated get/save/remove repository operations and an IndexedDB v2-to-v3 upgrade that preserves prior stores.
3. `TODO` Add the Settings route and resilient save, clear, loading, and error states.
4. `TODO` Show monthly goal progress in the saved ledger and preserve the existing shared-payment calculation.
5. `TODO` Verify lint, typecheck, tests, build, privacy boundary, responsive styles, documentation, and function-sized local commits.
