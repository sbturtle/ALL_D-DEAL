# Phase 3B — Local Transaction Storage, Period View, and Shared-payment Settlement

- Status: `DONE`
- Plan updated: 2026-08-05
- Prerequisite: Phase 3A Legacy XLS Preview `DONE`
- Evidence: Git-ignored `samples/private/` account-ledger and card-usage legacy XLS layouts

## Goal

Confirm valid Legacy XLS preview candidates as local `Transaction` records. Let the user review the saved records by day, rolling week, calendar month, or an explicit inclusive date range. Let the user explicitly connect a group-payment outflow and its reimbursement inflows so the living-expense budget uses their net amount while the original ledger remains unchanged.

## User value

- A confirmed import remains on the current browser device and can be reviewed without uploading its source file.
- The same records answer the user's immediate questions for one day, one week, one month, and a self-selected range.
- A group payment no longer makes the living-expense progress look larger than the portion the user ultimately paid.

## Scope and rules

- Native IndexedDB v1 stores `transactions`, `importBatches`, and `budgetSettlements`; source files, file names, blobs, complete card/account numbers, and preview state are never stored.
- Confirming a preview writes its `ImportBatch` and resulting transactions atomically. A failure leaves no partial import.
- Every range is inclusive and based on `occurredOn` (`YYYY-MM-DD`, Asia/Seoul):
  - `DAY`: the selected day.
  - `WEEK`: the selected day plus the preceding six calendar days.
  - `MONTH`: the calendar month containing the selected day.
  - `CUSTOM`: user-selected start and end dates.
- A shared-payment settlement is manual: one `OUTFLOW` payer transaction and one or more `INFLOW` reimbursement transactions. There is no automatic matching.
- The living-expense contribution of a settlement is `max(payer outflow - linked reimbursements, 0)`. It is assigned to the payer transaction's date, even when a reimbursement is received later. General balance, transaction direction/type, and source records never change.
- An unlinked living expense remains `EXPENSE + OUTFLOW`. A manually selected payer can be an `UNKNOWN + OUTFLOW` account record because the user explicitly identifies it as the group payment.

## Out of scope

- Duplicate detection, source-file digesting, automatic settlement inference, split transactions, refunds, category rules, and automatic type classification.
- A configurable living-expense target and target-setting UI; this slice supplies the net spending value that Phase 6 will compare to a target.
- Cross-device sync, server storage, financial-provider APIs, and storage of original XLS files.

## Tasks

1. `DONE` Document the period semantics, local-storage schema, and manual settlement calculation contract.
2. `DONE` Add pure domain rules for period ranges, shared-payment settlements, and net living-expense aggregation with boundary tests.
3. `DONE` Create the IndexedDB repository and atomic import-confirm application service, including explicit error results.
4. `DONE` Extend the import preview with an explicit local-save confirmation and success/failure state.
5. `DONE` Replace the dashboard's saved-data placeholder with period controls, local transaction list, net living-expense summary, and manual settlement controls.
6. `DONE` Run lint, typecheck, tests, production build, browser smoke checks without importing private samples, privacy scans, and focused code review.
7. `DONE` Record verification evidence and commit each independent change locally with the required message title and body.

## Acceptance criteria

- Confirmed valid preview candidates become complete validated `Transaction` records and an `ImportBatch` in one IndexedDB transaction; an unsuccessful confirmation writes neither.
- On the same device, saved records can be shown for one selected day, the prior seven inclusive days, the selected calendar month, and an inclusive custom range. Invalid custom ranges are not queried.
- The range list and counts contain only records whose `occurredOn` is in the requested range, ordered newest first.
- A user can create and remove a manual settlement only from one saved outflow and at least one saved inflow; duplicate participant IDs and a payer also listed as reimbursement are rejected.
- A manual settlement changes only the living-expense aggregate. It does not mutate the linked transactions or total inflow/outflow values.
- The dashboard clearly says that its living-expense value is a net figure for linked group payments and does not pretend to be a configurable target yet.
- Tests use fabricated transactions/candidates only; private samples, values, names, account identifiers, and original files are absent from tracked code, test fixtures, logs, and commits.
- All new commits are local, independently reviewable, use `[Type] : title`, and contain a non-empty body. Nothing is pushed.

## Risks and follow-up questions

- Account-ledger transactions begin as `UNKNOWN`; manual settlement selection is deliberately the user confirmation that an outflow was a group payment. Type-editing will be a later classification slice.
- Reimbursements may arrive after the payer date. Assigning the final net amount to the payer date makes the living-expense goal meaningful, but does not make this screen a cash-flow report.
- Deleting imported transactions and bulk import selection/exclusion require separate data-integrity decisions and remain outside this small slice.
