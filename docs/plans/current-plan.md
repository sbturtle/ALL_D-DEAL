# Phase 8F — User-Confirmed Keyword Category Grouping

- Status: `IN_PROGRESS`
- Plan updated: 2026-08-07
- Prerequisite: Phase 8E Review Queue and Transaction Direction Tone `DONE`

## Goal

Let a user group local transactions whose descriptions contain a confirmed keyword such as `네이버페이`, `오더`, or `쿠팡` into one category, while preserving one-by-one editing for exceptions.

## Scope and decisions

1. Keep the existing exact `CategoryRule` contract and add a separate local `KeywordCategoryRule` contract/store. Exact description rules keep priority over user-confirmed keyword rules.
2. A keyword rule is a normalized, user-entered substring. It is never inferred, learned, created from a payment intermediary, or applied without an explicit category and confirmation.
3. On Review, provide a touch-friendly “similar transactions group” flow. It shows the real local count before saving, categorizes only matching uncategorized `EXPENSE` transactions, stores the keyword for future Imports, and leaves already categorized transactions untouched.
4. Show only safe suggested chips when the current description contains a known user-facing payment/order marker (`네이버페이`, `오더`, `쿠팡`). The user can instead enter a different keyword, edit it, or cancel; suggestions do not save or classify anything by themselves.
5. Imported Preview applies exact rules first, then the longest matching keyword rule. If same-length keyword rules overlap, a stable lexical tie-breaker is used. Users can still change every Preview category before confirmation.
6. A batch group action is one explicit local operation. It preserves every changed Transaction field except `categoryId` and `updatedAt`, creates/replaces only the selected keyword rule, and does not create or change exact `CategoryRule` records.
7. Reuse the existing detailed transaction editor for later corrections. Do not add remote services, AI classification, third-party assets, private sample access, or automatic historical reclassification.

## Vertical slices

### Slice 1 — Keyword rule domain and local storage

- Add strict keyword normalization, validation, rule precedence, and fabricated tests.
- Upgrade IndexedDB with an independent keyword-rule store while preserving schema v1–v3 stores and exact rules.

### Slice 2 — Import and review group action

- Apply stored keyword rules in Import Preview after exact rules.
- Add an explicit Review modal that previews real matching count, lets the user choose keyword/category, atomically stores the rule and updates only matching uncategorized expenses.

### Slice 3 — Review, documentation, and completion

- Verify error, empty, cancellation, overlap, field-preservation, and individual-exception paths.
- Update requirements, category-rule contract, ADR, architecture, history, engineering log, and archive this plan after validation.

## Acceptance criteria

1. A user can enter or choose a suggested contained keyword, choose a category, see the actual local matching count, and explicitly apply the group without network access or mock counts.
2. The group operation changes only currently uncategorized matching `EXPENSE` transactions; already categorized transactions remain unchanged and can still be edited individually.
3. The stored keyword rule categorizes matching future Import Preview expenses after exact rules but before Merchant/Kakao fallback; every Preview result remains editable before saving.
4. Empty, invalid, sensitive-looking, too-short, no-match, storage error, cancellation, and overlapping-keyword cases have safe, tested behavior.
5. Existing exact rules, transaction import trace, amounts, dates, directions, types, settlements, review queue, local-first boundary, and privacy guarantees remain intact.
6. Primary controls are accessible and work at 360–430px without horizontal overflow or sub-44px touch targets.

## Out of scope

- Automatic keyword learning, silent grouping, remote/AI merchant classification, batch modification of already categorized transactions, and a full rule-management screen
- Changing payment-intermediary Kakao blocking or treating a keyword rule as merchant identity proof
- Reading, uploading, or committing `samples/private/` files
