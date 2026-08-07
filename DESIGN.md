# DESIGN.md

## 1. Product Identity

This product is a personal finance and household bookkeeping application designed for a single user.

It should feel like a lightweight personal mobile app rather than an enterprise financial dashboard.

Primary personality:

- Clean
- Calm
- Friendly
- Personal
- Slightly playful
- Trustworthy
- Mobile-native

The UI must never feel like:

- Enterprise admin software
- Accounting ERP
- Banking back-office software
- Spreadsheet UI
- Bootstrap dashboard

---

# 2. Design Philosophy

## Mobile First

The primary design target is an Android / Galaxy smartphone.

Target viewport:

```text
360px ~ 430px
```

Desktop is a responsive extension of the mobile experience.

Do not design desktop first and shrink it.

---

## Review, Not Data Entry

The application mainly automates transaction processing.

The user should mostly:

```text
Import
→ Review
→ Correct
→ Finish
```

rather than manually entering every transaction.

Therefore the UI must optimize for fast reviewing and correcting.

---

# 3. Visual Language

## Background

Primary background:

```css
--background: #f7f8fa;
```

Alternative warm surface:

```css
--background-soft: #fafafc;
```

---

## Surface

```css
--surface: #ffffff;
```

Cards should primarily be distinguished by spacing and surface rather than heavy borders.

---

## Primary

Soft indigo.

```css
--primary: #6c7ff2;
--primary-soft: #eef0ff;
```

Use for:

- Primary CTA
- FAB
- Progress highlights
- Selected navigation
- Important controls

---

## Secondary

Soft mint.

```css
--secondary: #63c7a5;
--secondary-soft: #eaf8f3;
```

Use sparingly.

---

## Text

```css
--text-primary: #1e2028;
--text-secondary: #6c707c;
--text-tertiary: #9a9da7;
```

---

## Semantic Colors

Positive:

```css
--positive: #45a77a;
```

Warning:

```css
--warning: #e8a34c;
```

Danger:

```css
--danger: #e36d6d;
```

Avoid highly saturated colors.

---

# 4. Typography

Primary font:

```text
Pretendard
```

Fallback:

```css
font-family:
  Pretendard,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  "Apple SD Gothic Neo",
  "Noto Sans KR",
  sans-serif;
```

Typography hierarchy:

```text
Hero Amount
28~34px / 700

Screen Title
22~24px / 700

Section Title
17~19px / 600~700

Body
14~16px / 400~500

Label
12~14px / 500

Caption
11~12px / 400~500
```

Money should use tabular numeric alignment when possible.

```css
font-variant-numeric: tabular-nums;
```

---

# 5. Spacing

Use an 8-point based spacing system.

Preferred values:

```text
4
8
12
16
20
24
32
40
48
```

Default mobile page padding:

```text
16px
```

Large mobile section spacing:

```text
24~32px
```

Avoid cramped layouts.

---

# 6. Radius

```text
Chip        10~12px
Input       12~14px
Button      14~16px
Card        18~22px
BottomSheet 24~28px
FAB         Circle
```

Rounded elements create the slightly cute personality of the product.

Do not make every element pill-shaped.

---

# 7. Shadows

Prefer flat surfaces.

When required:

```text
very subtle shadow
```

Heavy floating card shadows are prohibited.

---

# 8. Navigation

## Mobile

Use Bottom Navigation.

Primary destinations:

```text
Home
Transactions
Insights
Assets
```

Maximum 4~5 primary destinations.

Settings should not occupy prime navigation space unless necessary.

---

## Desktop

Do not automatically introduce a large sidebar.

Responsive bottom navigation may become:

- compact top navigation
- narrow side navigation

depending on available width.

Keep the content centered.

Maximum content width:

```text
1100~1280px
```

---

# 9. Floating Action Button

A circular Floating Action Button is a core interaction.

Location:

```text
bottom-right
```

It must respect:

- Bottom navigation
- Android safe area
- Browser safe area

Recommended diameter:

```text
56px
```

Primary visual:

```text
+
```

or another very simple action icon.

---

## FAB Actions

FAB should expose multiple common actions.

Priority:

```text
1. Import financial data
2. Review unresolved transactions
3. Add transaction manually
```

Preferred presentation:

### Option A

Speed Dial.

### Option B

FAB opens a Bottom Sheet.

Prefer the option that is easier to use with one hand.

---

# 10. Cards

Cards are used for semantic groups, not every piece of text.

Recommended:

```text
Monthly spending
Budget
Unresolved transactions
Savings goal
```

Avoid nested cards.

---

# 11. Home Screen

Priority hierarchy:

```text
1. Current monthly spending
2. Remaining budget
3. Transactions requiring review
4. Weekly spending summary
5. Recent transactions
6. Asset goals
```

Example:

```text
8월

이번 달 소비
684,200원

생활비
684,200 / 900,000원

76%

이번 달
215,800원 남았어요
```

---

# 12. Transactions

Do not use desktop tables as the primary mobile representation.

Use transaction rows.

Structure:

```text
Category Icon

Merchant
Category · Payment Method
Date / Time

Amount
```

Example:

```text
☕  메가MGC커피              -6,300원
    카페 · KB국민카드
    오늘 09:51
```

---

# 13. Transaction Detail

On mobile, transaction detail/edit should preferably use a Bottom Sheet.

Important actions:

```text
Edit Category
Edit Transaction Type
Add Memo
Apply Merchant Rule
Delete / Ignore
```

Primary editing actions should be reachable with one hand.

---

# 14. Classification Review

This is a critical workflow.

Transactions requiring user input should be handled quickly.

Example:

```text
분류가 필요한 거래

3개 남았어요

PAYCO오더
11,000원

8월 3일 · KB국민카드

어디에 사용하셨나요?

[식비]
[카페]
[데이트]
[쇼핑]
[교통]
[기타]
```

After selection, optionally advance to the next unresolved transaction.

---

# 15. Category Rules

When the user changes a category, clearly distinguish:

```text
이번 거래만 변경
```

and:

```text
앞으로 이 가맹점에도 적용
```

Never silently create a permanent rule without user awareness.

---

# 16. Import

File Import should feel like a product flow, not a developer file picker.

Preferred language:

```text
이번 주 소비 불러오기
```

rather than:

```text
Upload CSV/XLSX
```

After parsing:

```text
32건을 찾았어요

새 거래       24건
중복           5건
확인 필요      3건
```

Then:

```text
내용 확인하기
```

---

# 17. Import Preview

Mobile representation should be a list/card.

Each entry may contain:

```text
Merchant
Amount
Category
Classification Source
Review Status
Date
```

Developer/debug metadata should be expandable instead of always visible.

---

# 18. Category Presentation

Categories may use soft icon containers.

Examples:

```text
Food
Cafe
Convenience
Transportation
Shopping
Culture
Date
Medical
Subscription
Living
Other
```

Category color should assist recognition but never be the only indicator.

---

# 19. Touch

Minimum interactive area:

```text
44px
```

Preferred:

```text
48px
```

Do not rely on hover.

---

# 20. Bottom Sheets

Use Bottom Sheets for:

- Transaction editing
- Category selection
- FAB actions
- Filters
- Secondary options

Bottom Sheet header should provide a clear drag handle or dismissal mechanism.

---

# 21. Buttons

Primary button:

```text
Filled Primary
```

Secondary:

```text
Soft / Tonal
```

Tertiary:

```text
Text
```

Danger actions should not visually compete with primary actions.

---

# 22. Inputs

Inputs should have generous vertical space.

Avoid overly thin desktop-style text fields.

Recommended height:

```text
48~52px
```

---

# 23. Empty States

Empty states may contain subtle friendly language.

Good:

```text
아직 거래가 없어요.
금융 데이터를 가져오면 자동으로 정리해드릴게요.
```

Good:

```text
이번 주 분류가 모두 끝났어요 ✨
```

Avoid excessive illustrations or childish characters.

---

# 24. Microcopy

Use natural Korean.

Avoid technical terminology where users do not need it.

Prefer:

```text
금융 데이터 가져오기
```

over:

```text
Transaction Import
```

Prefer:

```text
분류가 필요한 거래
```

over:

```text
UNKNOWN
```

Technical values may remain visible only in debugging/developer views.

---

# 25. Motion

Motion should be subtle.

Recommended uses:

- FAB expansion
- Bottom Sheet appearance
- Progress updates
- Transaction review transitions
- Loading state

Avoid excessive animations.

---

# 26. Responsive Behavior

## Mobile

Single column.

## Tablet

Single or selective two-column layout.

## Desktop

Use whitespace and wider grids.

Do not simply stretch mobile cards across the entire viewport.

---

# 27. Web App / PWA Feel

Although implemented as a web application, the product should visually behave like an installed mobile app.

Important:

- Sticky mobile app bar when needed
- Bottom navigation
- FAB
- Bottom Sheets
- Safe-area awareness
- Touch-first interaction
- Minimal browser-like UI patterns

---

# 28. Accessibility

Maintain sufficient contrast.

Never communicate state only through color.

Interactive components need visible focus states.

Touch targets must remain accessible.

Typography should remain readable at mobile sizes.

---

# 29. Design Decision Hierarchy

When design rules conflict, apply this priority:

```text
1. Usability
2. Information clarity
3. Mobile ergonomics
4. Accessibility
5. Visual consistency
6. Personality
7. Decoration
```

---

# 30. Product Personality Rule

The target personality is:

```text
깔끔함 70%
친근함 20%
귀여움 10%
```

The product should feel pleasant and personal without becoming childish.

---

# 31. Do Not

Do not:

- redesign the domain logic
- remove existing features
- turn every section into a card
- create an enterprise dashboard
- overuse gradients
- overuse emojis
- overuse glassmorphism
- use tiny fonts
- use dense desktop tables on mobile
- introduce sidebars on mobile
- rely on hover
- hide important financial values

---

# 32. Core Mobile Flow

The design must support this flow smoothly:

```text
Home

 ↓ FAB

Import Financial Data

 ↓

Import Preview

 ↓

Resolve Unclassified Transactions

 ↓

Correct Category

 ↓

Save Merchant Rule if desired

 ↓

Home Updated
```

This flow should require as few taps as reasonably possible.
