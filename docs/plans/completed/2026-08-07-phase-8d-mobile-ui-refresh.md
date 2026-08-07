# Phase 8D — Mobile App UI/UX Refresh

- Status: `DONE`
- Plan updated: 2026-08-07
- Prerequisite: Phase 8C Merchant Name Resolution `DONE`
- Design sources: repository `DESIGN.md` and the user-provided five-screen HTML reference

## Goal

Rebuild the existing local-first ledger UI as a calm, friendly, touch-first mobile app without removing features, inventing financial data, or changing domain and persistence contracts.

The primary viewport is 360–430px. Desktop is a centered responsive extension, not a separate enterprise dashboard.

## Repository findings and design decisions

1. The reference contains five visual directions: Home, Transactions, classification review, Import, and payroll result. `DESIGN.md` wins where the reference conflicts.
2. Do not copy external Google fonts, Material Symbols, remote images, Tailwind CDN, `user-scalable=no`, hard-coded financial values, or simulated loading from the reference. Use Pretendard fallbacks, local CSS, inline SVG icons, real state, and existing calculations.
3. Split the current combined ledger experience into canonical `/home` and `/transactions` routes. `/` maps to Home and the existing `/ledger` remains a backward-compatible alias for Transactions. Keep the small History API router.
4. Mobile bottom navigation contains Home, Transactions, Payroll, and Settings. Import remains its own `/imports` workflow and is the primary FAB quick action on Home and Transactions; the FAB stays hidden on focused Import, Payroll, and Settings screens. Do not add empty Insights, Assets, profile, sharing, or manual-transaction features.
5. Keep the existing Dashboard state and financial calculations. Separate only the Home and Transactions presentations so period filters, shared-payment net spending, transaction editing, Mock mode, and local settings remain intact.
6. On Home and Transactions, the FAB opens an accessible bottom sheet containing only existing destinations. It must support Escape, an explicit close action, first-action focus, and focus return.
7. Use semantic indigo/mint design tokens, 8-point spacing, 18–22px cards, 48px controls, 44px minimum targets, subtle shadows, tabular money, safe-area padding, visible focus, and reduced-motion support.

## Vertical slices

### Slice 1 — App shell and routes

- Add `/home` and `/transactions`, preserve `/ledger`, and update route tests.
- Add inline SVG icons, sticky app bar, mobile bottom navigation, responsive desktop navigation, FAB and accessible quick-action sheet.
- Remove the large marketing footer and developer Phase chip from the primary UI.

### Slice 2 — Home and Transactions

- Home shows actual monthly living expense, budget progress or setup guidance, real review count, weekly spending bars, recent transactions, and empty/error/loading states.
- Transactions keeps day/week/month/custom ranges, real summaries, Mock mode, all stored rows, memo/category editing, and shared-payment settlement.
- Add transaction filters for all, expense, income, and review-needed rows.
- Present transaction editing as a mobile bottom sheet while preserving the current update contract.

### Slice 3 — Import and classification review

- Turn the file picker into a clear `이번 주 소비 불러오기` flow with real reading, Kakao analysis, preview, duplicate, issue, selection, and save states.
- Show real preview counts instead of invented totals.
- Keep candidate rows touch-friendly and move category selection to an accessible mobile bottom sheet with all current categories.
- Keep user-rule consent separate, debug metadata collapsed, stale-result protection intact, and the save action reachable above the safe area.

### Slice 4 — Payroll and Settings

- Restyle payroll input and result hierarchy to match the reference: input summary, monthly take-home hero, deduction ratio/details, cautions, and policy details. Preserve every input, validation, result focus, and memory-only boundary.
- Restyle Settings around the one real monthly living-expense goal and preserve load, retry, save, clear, and local-only states.

### Slice 5 — Verification and documentation

- Run lint, typecheck, all tests, build, privacy review, and staged diff checks.
- Browser-check 360, 390, 430, 768, and 1280px without uploading private XLS data.
- Verify overflow, bottom-nav/FAB overlap, 44px targets, keyboard focus, sheet Escape/focus return, reduced motion, and console errors.
- Update requirements/history, ADR-0008 or a follow-up ADR, architecture, engineering log, and this plan.

## Acceptance criteria

1. The app opens Home at `/` and `/home`; `/transactions` is separate and `/ledger` still reaches the transactions experience.
2. Mobile navigation, and the Home·Transactions FAB where present, remain reachable with one hand, respect safe areas, have 44px or larger targets, and expose correct accessible names/current state.
3. No horizontal overflow or clipped primary amount occurs at 360, 390, or 430px.
4. Home uses local transactions, settlements, and settings only and never displays fabricated financial values. Mock values appear only in the explicit Transactions Mock mode.
5. Transactions retains all existing period, editing, and settlement behavior and gains understandable row filtering and a mobile edit sheet.
6. Import retains every duplicate/category/rule/Kakao/trace/save behavior while presenting actual counts and a product-like review flow.
7. Payroll retains all inputs, 2026 policy calculations, validation, result focus, source links, and the no-storage promise.
8. Settings retains its complete local goal lifecycle.
9. No external design CDN, analytics, remote icon/font, or reference-image request is added.
10. Targeted tests, full quality commands, responsive browser checks, documentation, and function-sized local commits pass before `DONE`.

## Completion record

- App shell/routes, Home/Transactions, Import/classification review, Payroll/Settings, and verification/documentation slices are complete.
- `npm run lint`, `npm run typecheck`, `npm test` (39 files, 410 tests), `npm run build`, and `git diff --check` passed. The build retains only the pre-existing bundle-size warning for a chunk larger than 500 kB.
- Browser checks passed at 360, 390, 430, 768, and 1280px with no horizontal overflow, undersized primary controls, or console errors.
- The quick-action sheet and transaction/category sheets were checked for Escape close, focus movement, and focus return. The FAB is limited to Home and Transactions so it does not cover focused Import, Payroll, or Settings controls.
- Browser verification used an empty local database and temporary in-memory payroll values only. No file from `samples/private/` was opened or uploaded.
- Review found and fixed two responsive defects before completion: the Import intro inherited a legacy multi-column grid, and the global FAB could cover the Payroll input-mode control.
- Final code review also unified Home and Transactions review-needed semantics with the Import contract, then guarded Import confirmation against stale save results, reset actions during saving, and confirmation while Kakao analysis is pending. Duplicate lookup failures no longer present an unverified new count, and the category sheet identifies the transaction being edited.

## Out of scope

- New Insights, Assets, profile, manual transaction, sharing, authentication, or cloud features
- Domain, parser, CategoryRule, Merchant Resolution, Kakao, payroll-policy, or IndexedDB redesign
- PWA installation, Android implementation, backend, analytics, and remote design assets

## Archive

- Archived on 2026-08-07 after Phase 8D reached `DONE`.
