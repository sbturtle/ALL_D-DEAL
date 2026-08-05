# Confirmed Category Rule Contract

- Status: Implemented in Phase 5
- Date: 2026-08-05
- Related: [ADR-0007](../adr/ADR-0007-confirmed-description-category-rules.md)

## Initial categories

| ID | Label |
| --- | --- |
| `FOOD_DINING` | 식비·외식 |
| `TRANSPORT` | 교통 |
| `HOUSING_UTILITIES` | 주거·공과금 |
| `SHOPPING` | 쇼핑 |
| `HEALTH` | 건강 |
| `EDUCATION` | 교육 |
| `LEISURE` | 여가 |
| `SUBSCRIPTION` | 구독 |
| `OTHER` | 기타 |

`Transaction.categoryId` is optional. Missing `categoryId` means **미분류**, so all existing stored transactions remain valid without migration of their records.

## Rule key and privacy boundary

The current XLS importers do not supply a reliable separate merchant field. A rule therefore compares an exact normalized `descriptionOriginal` key: Unicode NFKC, lower case, punctuation/symbol replacement with spaces, whitespace collapse, and trim.

The key is not a proof of merchant identity, a fuzzy match, or a cryptographic value. Rule creation rejects normalized descriptions longer than 300 characters or containing five or more consecutive ASCII digits. This avoids storing a new reusable derivative of a likely account/card identifier. The original Import file, file name, full source row, and remote copy are never stored.

## Preview and confirmation flow

```text
Legacy XLS Preview
  → read local categoryRules
  → fill an exact matching category in the Preview only
  → user changes category as needed
  → user separately chooses “apply to this description in the future”
  → selected candidates + confirmed rules commit atomically
```

- A stored rule is always visible in the category selector and can be changed before confirmation.
- Changing a category alone saves only that Transaction category; it does not create a rule.
- A rule is requested only for a selected candidate with a chosen category and explicit rule consent.
- A duplicate-candidate that remains excluded cannot create a category rule.
- Two consent requests with one normalized description but different categories reject the confirmation safely. Existing records remain unchanged.

## Local storage

IndexedDB schema v2 adds `categoryRules` with `matchDescriptionNormalized` as its key. A `CategoryRule` stores:

| Field | Meaning |
| --- | --- |
| `matchDescriptionNormalized` | exact local description comparison key |
| `categoryId` | confirmed initial category |
| `createdAt` | first local creation time |
| `updatedAt` | last confirmed replacement time |

`BrowserLedgerRepository.commitImport` writes `ImportBatch`, selected `Transaction` values, and any confirmed rules in one read-write transaction. Rule replacement uses the same key and never changes a previous Transaction. Existing v1 databases upgrade by creating an empty `categoryRules` store.

An IndexedDB v2 upgrade block fails the open request immediately. A request that emits no terminal event is bounded to five seconds and then rejects, so the Dashboard leaves its loading state and shows the existing safe local-storage message. No storage contents are altered by either failure.

## Deferred work

Custom categories, a rule management screen, rule deletion, historical bulk reclassification, merchant-field matching, fuzzy/AI classification, and Dashboard category analytics require separate decisions.
