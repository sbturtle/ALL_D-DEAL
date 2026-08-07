# Confirmed Category Rule Contract

- Status: Implemented in Phase 5
- Date: 2026-08-05
- Related: [ADR-0007](../adr/ADR-0007-confirmed-description-category-rules.md), [Merchant Resolution Contract](merchant-resolution-contract.md)

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

Phase 8C Merchant normalization과 이 규칙 키는 목적이 다르다. 저장 규칙은 계속 기존 `normalizeCategoryRuleDescription(descriptionOriginal)`의 정확 일치만 사용하고 Alias·Fuzzy·Kakao 결과로 넓히지 않는다. 따라서 이미 확인한 사용자 규칙이 있으면 해당 카테고리를 Preview에 채우고 Merchant resolver와 모든 Kakao 호출을 건너뛴다.

## Preview and confirmation flow

```text
Legacy XLS Preview
  → read local categoryRules
  → fill an exact matching category in the Preview only
  → only unresolved expense candidates enter Merchant/Kakao analysis
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

Custom categories, a rule management screen, rule deletion, historical bulk reclassification, persistent merchant-field rules, user-managed Merchant Alias/Cache, AI classification, and Dashboard category analytics require separate decisions. Phase 8C의 Alias·Fuzzy는 Preview 검색어 해석일 뿐 새 CategoryRule을 자동 생성하지 않는다.
