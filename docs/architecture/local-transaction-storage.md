# Local Transaction Storage Contract

> Status: Phase 9A implemented
>
> Updated: 2026-08-07

## Browser database

The browser uses native IndexedDB database `household-ledger`, schema version `4`.

| Store | Key | Index | Stored purpose |
| --- | --- | --- | --- |
| `transactions` | `id` | `occurredOn`, `importBatchId` | Confirmed normalized transactions only |
| `importBatches` | `id` | `committedAt` | Import provenance and counts |
| `budgetSettlements` | `id` | `payerOutflowTransactionId` | Explicit group-payment links |
| `categoryRules` | `matchDescriptionNormalized` | — | User-confirmed category choices for future Import Preview candidates |
| `keywordCategoryRules` | `keywordNormalized` | — | User-confirmed included-keyword category choices for current Review grouping and future Import Preview candidates |
| `userSettings` | `id` (`current`) | — | One local monthly living-expense goal and its update time |

The source XLS blob, original file name, parser row arrays, preview state, full account/card numbers, and source financial identifiers are never stored.

## Atomic import confirmation

`confirmLegacyXlsImport` converts valid Preview candidates into complete validated `Transaction` records. Each carries a generated UUID, one `ImportBatch` UUID, `LEGACY_XLS` importer ID, and UTC creation/update timestamps.

The repository writes the `ImportBatch` and all transactions in one IndexedDB read-write transaction. Any add failure aborts the whole operation; no batch or partial transaction set remains. The UI receives a generic failure result and does not expose source data.

## Period lookup

`occurredOn` is a date-only `YYYY-MM-DD` string. The `transactions.occurredOn` index is queried with inclusive bounds and results are sorted newest first.

| Control | Query range |
| --- | --- |
| 하루 | selected date only |
| 최근 1주 | selected date and previous six calendar dates |
| 이번 달 | first through last date of selected date's calendar month |
| 직접 선택 | selected start and end dates, inclusive |

The anchor and display semantics use `Asia/Seoul`; no date-only value is converted through a UTC timestamp.

## Shared-payment settlement

`BudgetSettlement` stores one payer `OUTFLOW` transaction and one or more reimbursement `INFLOW` transactions. The save use case validates participant existence, direction, duplicate IDs, and that no participant already belongs to another settlement.

For a selected period, ordinary `EXPENSE + OUTFLOW` records are summed. A linked payer is replaced with `max(payer amount - all linked reimbursement amounts, 0)` when the payer date is in the period. Reimbursements may be later than the payer date; their amount remains attributed to the payer date for budget progress. The linked original transactions and normal inflow/outflow totals are not mutated. See [ADR-0005](../adr/ADR-0005-manual-shared-payment-settlements.md).

## Local monthly living-expense goal

`userSettings` is a singleton record keyed by `current`. It contains only a positive KRW safe-integer `monthlyLivingExpenseGoalMinor` and a UTC `updatedAt` value. Saving replaces that one record; clearing removes it. No default amount is stored or inferred.

The saved ledger reads the goal only for its calendar-month view. It compares the goal with `calculateLivingExpenseSummary`, so linked shared payments contribute their net out-of-pocket spending. Day, week, and custom ranges show actual spending without proportional goal allocation. Payroll calculator inputs and results never enter this store. See [ADR-0011](../adr/ADR-0011-local-monthly-living-expense-goal.md).

## Confirmed local-ledger reset

`resetLocalLedger` opens one read-write transaction over all six stores and calls `clear()` on each. The schema, database name, browser origin, source files, and application configuration stay intact. An abort or request error rejects the operation, so the UI keeps its confirmation dialog open and never reports a successful reset.

The Settings control opens an accessible confirmation dialog before calling this operation. The dialog lists the six affected data groups, states that the action cannot be undone, and says that original Excel files, samples, app code, and environment settings are not affected. Backdrop dismissal, Escape, and cancel never invoke the repository operation. See [ADR-0013](../adr/ADR-0013-confirmed-local-ledger-reset.md).
