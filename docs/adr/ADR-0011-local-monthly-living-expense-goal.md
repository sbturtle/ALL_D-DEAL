# ADR-0011 Local Monthly Living-Expense Goal

- Status: Accepted
- Date: 2026-08-05

## Context

The ledger already supports day, week, month, and custom date ranges. It also preserves original transactions while calculating a linked shared payment as net out-of-pocket living expense. The product requires a user-editable living-expense goal and remaining amount, but neither a real goal amount nor a proration policy was supplied.

## Decision

- Store one `userSettings` record in IndexedDB schema v3, keyed by `current`.
- The record accepts only a positive KRW safe integer monthly goal and a UTC update time. Clearing the goal deletes the record; no default financial value is fabricated.
- Show goal progress only in the calendar-month ledger view. Compare the goal with the existing net living-expense summary, including manually linked shared-payment reimbursements.
- Day, week, and custom views show actual spending only and state that the monthly goal is not proportionally allocated.
- Keep the goal local to the browser. Do not send it to a server, Kakao, URL, logs, test fixtures, or the payroll calculator's memory-only state.

## Consequences

The user receives a simple and explainable monthly remaining/exceeded amount without mutating cash-flow records. The policy intentionally does not define daily or weekly budgets, multi-goal planning, savings capacity, or links to salary estimates; those need separate user requirements.
