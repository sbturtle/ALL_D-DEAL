# Phase 8E — Review Queue and Transaction Direction Tone

- Status: `DONE`
- Plan updated: 2026-08-07
- Prerequisite: Phase 8D Mobile App UI/UX Refresh `DONE`

## Goal

Let a user process a large local backlog of category-needed transactions one at a time in a dedicated, touch-first review queue, while making income and expense transaction cards immediately distinguishable.

## Scope and decisions

1. Add a canonical `/review` route. Keep the four-item primary bottom navigation unchanged; reach Review from the Home review summary and the Transactions review filter so the primary navigation does not become crowded.
2. Move the definition of a review-needed transaction into a tested Domain helper: `UNKNOWN`, or an `EXPENSE` with no category. Dashboard and the new page must share it.
3. The one-by-one queue auto-selects the next category-needed `EXPENSE`, shows real local remaining progress, merchant/date/amount/payment context, and provides large category choices. A chosen category saves only that Transaction and advances to the next queued transaction.
4. Preserve FR-033: the review queue must not change a transaction's amount, date, direction, type, import trace, or any category rule. Category rule creation and transaction-type correction remain out of scope.
5. `UNKNOWN` is a transaction-type review, not a category-needed expense. Show its real count and a direct path back to Transactions rather than falsely resolving it by attaching a category.
6. Use no mock data, backend, analytics, remote asset, or private financial sample. Store no queue cursor or transaction data beyond the existing local Transaction update.
7. Apply a semantic, accessible visual treatment to real and mock transaction rows: soft rose/red for OUTFLOW and soft mint/green for INFLOW, with text/icon contrast that does not rely on colour alone.

## Vertical slices

### Slice 1 — Shared review rule and route

- Add the Domain review-needed helper and tests.
- Add `/review`, route tests, title, route focus behavior, and clear entry points from Home and Transactions.

### Slice 2 — One-by-one category review

- Load local transactions, queue only category-needed expenses, and render loading, empty, error/retry, active, save, and save-error states.
- Save a selected category through the existing single-transaction update use case, announce progress, and advance to the next queued expense.
- Make the active card and category buttons touch-friendly with merchant, date, signed amount, type, and payment context.

### Slice 3 — Direction colour and finalisation

- Apply direction classes to transaction rows and implement accessible income/expense colour tokens.
- Run targeted tests, lint, typecheck, full tests, build, responsive browser checks without private XLS data, review, document, and make function-sized local commits.

## Acceptance criteria

1. `/review` is reachable from the Home review summary and Transactions review filter, works with History navigation, has a descriptive title, and returns focus to its main content after navigation.
2. The page displays real local category-needed expense counts and never invents a 771-like number, progress value, or financial amount.
3. Selecting a category updates exactly one local `EXPENSE` through the existing validation path, preserves all other Transaction fields, removes it from the active category queue, and advances to the next available expense.
4. Empty, loading, save failure, repository failure, and no-more-category-needed-expenses states give a clear next action.
5. `UNKNOWN` records are not treated as successfully category-classified; their count and limitation are explicit.
6. Transaction cards visibly distinguish OUTFLOW from INFLOW with labels/signs as well as colour, at 360–430px without horizontal overflow or sub-44px primary targets.
7. Existing Home, Transactions, Import, payroll, and local setting behaviors remain intact. No private sample is read or committed.

## Completion record

- `/review` is a direct, History-compatible route with entry points from the Home review summary and Transactions review filter. The four-item primary navigation remains unchanged.
- The shared Domain predicate keeps `UNKNOWN` as a transaction-type review. The queue loads only real local uncategorized `EXPENSE` transactions, saves one selected category through the existing single-Transaction use case, preserves all protected fields, and advances to the next transaction.
- Loading, empty, retry, save failure, unknown-type limitation, progress, skip, and completion states are covered by UI tests with fabricated transactions only.
- Income and expense rows now use semantic mint and rose cards respectively, while keeping `+`/`−` signs and contrast so direction is not encoded by colour alone.
- Verification: targeted review and dashboard tests passed; `npm run lint`, `npm run typecheck`, `npm test` (41 files, 419 tests), and `npm run build` passed. Build retains only the pre-existing Vite >500 kB chunk warning.
- Browser review: `/review` and mock Transactions were checked at 360px with no horizontal overflow; transaction rows measured 96px high and rendered as mint income / rose expense. No private XLS was opened, uploaded, or committed.

## Out of scope

- Changing a saved Transaction's type, direction, amount, date, import trace, or creating CategoryRules from this page
- Batch category assignment, automatic/AI category suggestions, ranking, cloud sync, or backend work
- Replacing the existing detailed transaction editor or adding a fifth primary bottom-navigation item
