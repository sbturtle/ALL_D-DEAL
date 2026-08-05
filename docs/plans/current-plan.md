# Phase 5 — Confirmed Category Rules

- Status: `DONE`
- Plan updated: 2026-08-05
- Prerequisite: Phase 4 Duplicate Candidate Review `DONE`

## Goal

Let the user assign a category while reviewing a Legacy XLS Preview. Reuse a previously confirmed rule for the same normalized transaction description, but keep every automatic category visible and editable before local storage.

## Scope and rules

- Phase 5 uses a fixed initial category set: `FOOD_DINING`, `TRANSPORT`, `HOUSING_UTILITIES`, `SHOPPING`, `HEALTH`, `EDUCATION`, `LEISURE`, `SUBSCRIPTION`, and `OTHER`. No category means unclassified.
- The current importers do not provide a separate merchant field. Rules therefore use an exact, normalized `descriptionOriginal` key. When a reliable merchant field arrives, its matching policy requires a new decision.
- Stored rules apply their category only to a new Preview. The category remains visible in the selector and is never stored automatically without the existing Preview confirmation action.
- The user may change a category for any Preview candidate. A rule is created or replaced only when the user explicitly checks “apply to this description in the future” and that candidate is selected for storage.
- `Transaction.categoryId` is optional. Existing transactions remain valid and unclassified; creating or replacing a rule never rewrites them.
- Category rules and selected import transactions are committed in the same IndexedDB transaction. A rule conflict for the same normalized description and different categories rejects confirmation safely.
- Native IndexedDB moves from v1 to v2 only to add the `categoryRules` store. No source file, file name, original row, remote request, or private sample is stored.
- If IndexedDB reports an upgrade block or does not finish opening within five seconds, the app stops loading and presents its existing safe local-storage error state.

## Out of scope

- Custom category creation, category hierarchy, a rule list/editor, bulk reclassification of saved transactions, and Dashboard-by-category analytics.
- Fuzzy merchant matching, AI classification, category suggestions without a confirmed rule, and cross-device sync.

## Tasks

1. `DONE` Record Phase 5 requirements, initial taxonomy, description-key limitation, confirmation policy, and v2 migration decision.
2. `DONE` Add and test CategoryId, category-rule normalization/validation, and optional transaction category validation.
3. `DONE` Add IndexedDB v2 category-rule storage, atomic import/rule commit, and rule reading.
4. `DONE` Apply stored rules to Preview and add editable category plus explicit rule-consent controls for every candidate.
5. `DONE` Verify rule reuse, individual edits, rule conflicts, duplicate-candidate selection interaction, migration, privacy boundaries, and existing flows.
6. `DONE` Run lint, typecheck, tests, build, browser smoke checks, documentation, review, and focused local commits.

## Acceptance criteria

- A saved exact normalized description rule supplies a visible, editable category to a later Preview.
- An unclassified candidate can be categorized without creating a rule; a rule requires an additional explicit user choice.
- Only selected candidates can create rules; a duplicate candidate excluded from storage cannot create one.
- A confirmation that stores a rule commits it atomically with its selected transaction batch, while prior transactions remain unchanged.
- Existing v1 local data upgrades safely to v2 and remains readable.
- Tests use fabricated descriptions and values only; private XLS data remains outside Git, logs, fixtures, and commits.
- All changes are verified and committed locally by function using `[Type] : title` plus a non-empty body; nothing is pushed.
