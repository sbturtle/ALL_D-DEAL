# ALL D·DEAL 디자인 시스템

## 1. 브랜드 정체성

`ALL D·DEAL`은 흩어진 금융 기록과 모든 거래를 한곳에서 정리하는 로컬 우선 서비스다. 제품을 ‘가계부’라고 부르지 않고, 사용자가 자신의 데이터를 알뜰하게 바라보고 다음 결정을 내리도록 돕는 기록 도구로 포지셔닝한다.

로고 락업은 아래 두 줄을 고정으로 사용한다.

```text
ALL D·DEAL
알뜰
```

브랜드 문장:

```text
흩어진 금융 기록을 알뜰하게.
```

제품 성격:

- 또렷함
- 차분함
- 영리함
- 친근함
- 신뢰감
- 모바일 우선

화면은 기업용 관리자 도구, 회계 ERP, 은행 백오피스, 스프레드시트처럼 보이지 않아야 한다.

## 2. 브랜드 전환 토큰

2026-08-11 브랜드 전환부터 아래 토큰을 기존 생활비 중심 표현보다 우선한다. 기능명과 금융 도메인 용어는 사용성을 위해 유지하되, 제품명과 첫 인상에는 `ALL D·DEAL`과 `알뜰`을 사용한다.

| 역할 | 토큰 | 값 | 사용처 |
| --- | --- | --- | --- |
| 잉크 | `--brand-ink` | `#1b261f` | 본문과 제목 |
| 숲색 | `--brand-forest` | `#174735` | 주요 버튼, 활성 상태, 로고 보조 |
| 짙은 숲색 | `--brand-forest-strong` | `#0f3226` | 눌림 상태, 어두운 표면 |
| 알뜰 라임 | `--brand-lime` | `#d9f26f` | 워드마크 강조, 선택 표시 |
| 크림 바탕 | `--brand-cream` | `#f5f1e8` | 앱 배경 |
| 종이 표면 | `--brand-paper` | `#fffdf7` | 카드와 시트 |
| 옅은 민트 | `--brand-mint` | `#e8f1e8` | 보조 표면 |

워드마크는 대문자 고정, 자간을 약간 넓게 사용한다. `알뜰`은 작은 보조 라벨로 두어 로고의 위계를 흐리지 않는다. 색상은 라임과 숲색 두 가지를 중심으로 사용하고, 화면마다 새로운 강조색을 추가하지 않는다.

## 3. 브랜드 컴포넌트

### 브랜드 락업

- **구조**: `ALL D·DEAL` 워드마크 위에 `알뜰` 보조 라벨을 배치한다.
- **상태**: 기본, 포커스, 축소 화면에서의 말줄임을 지원한다.
- **접근성**: 로고 링크의 접근 가능한 이름은 `ALL D·DEAL 알뜰 홈`으로 제공한다.
- **레이아웃**: 앱 상단 바의 고정 영역 안에서 화면 제목과 나란히 배치한다.

### 브랜드 홈 히어로

- **구조**: 브랜드 킥커, 한 문장 제목, 로컬 데이터 설명, 금액 요약으로 구성한다.
- **상태**: 기본, 로딩, 오류, 빈 데이터 상태를 기존 대시보드 컴포넌트가 담당한다.
- **모션**: 기존의 짧은 전환과 `prefers-reduced-motion` 규칙을 유지한다.

## 4. 접근성 제약과 허용된 부채

- 본문 대비는 WCAG 2.2 AA를 목표로 하며, 본문은 4.5:1 이상을 유지한다.
- 로고·현재 화면명·하단 메뉴는 색상만으로 구분하지 않는다.
- 터치 대상은 최소 44px, 기본 48px을 유지한다.
- `prefers-reduced-motion`을 존중한다.
- 현재 범위에서는 기존 세부 화면의 생활비 관련 기능명은 도메인 명확성을 위해 유지한다. 다음 브랜딩 슬라이스에서 거래·가져오기·설정 화면의 첫 문장까지 같은 톤으로 통일한다.

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
