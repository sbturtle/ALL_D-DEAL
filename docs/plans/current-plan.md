# Phase 6B — Account Transaction Type Classification

- Status: `IN_PROGRESS`
- Plan updated: 2026-08-05
- Prerequisite: Phase 5 Confirmed Category Rules `DONE`, Phase 6A Workflow Pages and Category Review UX `DONE`

## Goal

Classify account-ledger Import candidates into transaction types before category handling, so card usage remains the primary expense source and account cash flow does not double-count card payments.

## Scope and rules

- Use one small, pure, deterministic rule engine over the existing safe account-candidate fields: direction and `descriptionOriginal`. It returns a type, a non-sensitive reason code, and a confidence level for the in-memory Preview only.
- The first rule set recognizes explicit card-payment, savings, loan-payment, investment, transfer, income, and reward wording. A non-match remains `UNKNOWN` and is shown as needing review.
- Add `REWARD` and `SELF_TRANSFER` to the domain vocabulary. This slice does not infer `SELF_TRANSFER`: owner account aliases have not been configured, so ambiguous transfers stay `TRANSFER` or `UNKNOWN` for user review.
- A category is applied only to an `EXPENSE` Preview candidate. Existing persisted Transactions are not rewritten or invalidated, preserving data entered before this rule.
- Card usage XLS remains `EXPENSE + OUTFLOW`; account `CARD_PAYMENT` is cash flow and is excluded from living-expense aggregation by the existing `EXPENSE + OUTFLOW` rule.
- Classification metadata must not store raw source rows, account/card numbers, names, memo text, or financial identifiers. It is discarded after Import confirmation.

## Out of scope

- User-managed own-account aliases, transfer counterpart matching, a generic DSL, bulk reclassification, or a persisted classification-rule editor.
- Merchant/brand matching, expanded expense taxonomy, user-defined categories, and category analytics.
- Kakao or other external provider APIs, credentials, OAuth/browser REST flow, remote persistence, or automatic sync.

## Tasks

1. `DONE` Inspect completed Phase 5/6A work, current imports, domain tests, private-data boundaries, and Git state.
2. `IN_PROGRESS` Record the card-as-expense/account-as-cash-flow contract, rule-engine boundary, and deferred data requirements in requirements history and an ADR.
3. `PENDING` Add and test the pure account transaction-type classifier and safe Preview metadata.
4. `PENDING` Apply the classifier to account XLS candidates and limit category reuse/selection to expense candidates.
5. `PENDING` Show type, reason, and confidence clearly in the Import Preview without exposing source identifiers.
6. `PENDING` Run lint, typecheck, tests, build, privacy/Git checks, review the diff, update implementation records, and create function-sized local commits.

## Acceptance criteria

- An account row with an explicit card-payment marker previews as `CARD_PAYMENT`; it cannot enter the living-expense total.
- Explicit savings, loan-payment, investment, transfer, income, and reward markers use their matching type only in their valid direction; unmatched rows remain `UNKNOWN` with review status.
- The Preview exposes a non-sensitive source/reason/confidence explanation, and confirmation persists the Transaction type but not Preview classification metadata.
- Card usage rows remain `EXPENSE + OUTFLOW`; category rules and quick selection are available only to `EXPENSE` Preview candidates.
- `SELF_TRANSFER` remains unclassified automatically until a future, user-controlled account-alias design exists.
- Tests use fabricated rows only. `samples/private/`, raw financial values, identities, file names, account/card numbers, and approval numbers do not enter Git, docs, test fixtures, logs, or commits.
- All changes are verified and committed locally by function using `[Type] : title` plus a non-empty body; nothing is pushed.
