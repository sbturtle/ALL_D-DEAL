# Phase 6A — Workflow Pages and Category Review UX

- Status: `IN_PROGRESS`
- Plan updated: 2026-08-05
- Prerequisite: Phase 5 Confirmed Category Rules `DONE`

## Goal

Split the long single-page application into focused Ledger, Import, and Payroll pages. Make individual Import category choices fast and easy to inspect while preserving Phase 5's explicit rule-consent and local-only boundaries.

## Scope and rules

- Client routes are `/ledger`, `/imports`, and `/payroll`; `/` resolves to `/ledger`. Navigation updates browser history and reacts to back/forward without adding a routing dependency.
- Only the active work page renders: Ledger contains period summaries and manual settlement; Import contains file selection and Preview confirmation; Payroll contains its existing memory-only calculator.
- Category quick selection uses the fixed Phase 5 set and makes the selected category or 미분류 visible on every candidate. A candidate opens one compact category button grid at a time.
- Category selection and future-rule consent remain separate. A rule still requires a selected candidate, a category, and explicit consent; excluded duplicate candidates cannot create rules.
- No source file, file name, original row, remote request, or private sample is stored or shown by the routing or category UI.

## Out of scope

- 생활비 목표·잔액, 저축 가능액, 급여 예상과 실제 수입 비교, 사용자 Settings와 Dashboard-by-category analytics.
- Custom category creation, category hierarchy, a rule list/editor, bulk reclassification, fuzzy/AI classification, and cross-device sync.

## Tasks

1. `DONE` Record page-navigation and category-review UX requirements, constraints, and routing decision.
2. `TODO` Add and test the minimal History API route model, accessible navigation, and separate Ledger, Import, and Payroll page composition.
3. `TODO` Move Import Preview out of the Ledger page without changing its file, duplicate, confirmation, or local-storage boundaries.
4. `TODO` Replace per-candidate select controls with accessible compact category quick selection and clearly separate rule consent.
5. `TODO` Verify direct paths, history navigation, category edits/rule consent/duplicate exclusion, existing local flows, privacy, and small-screen layout.
6. `TODO` Run lint, typecheck, tests, build, browser checks, review, documentation, and focused local commits.

## Acceptance criteria

- Each major task has a unique URL, accessible current-page navigation, and working browser back/forward handling.
- Loading a work page renders only its intended calculator, ledger, or Import interaction; local storage and file behavior are unchanged.
- A user can open one candidate's category picker, choose or clear a category with touch-friendly buttons, and see whether a prior rule filled it.
- An unclassified candidate can be categorized without a rule, while a selected categorized candidate can independently opt into a future rule.
- Duplicate exclusion, atomic confirmation, existing rule reuse, and prior transaction preservation continue to work.
- Tests use fabricated descriptions and values only; private XLS data remains outside Git, logs, fixtures, and commits.
- All changes are verified and committed locally by function using `[Type] : title` plus a non-empty body; nothing is pushed.
