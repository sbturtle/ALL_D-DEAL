# Code Convention

> 상태: Phase 1부터 적용하는 초기 규약
>
> 기준일: 2026-08-05

## 기본 원칙

- 현재 요구를 해결하는 가장 작은 코드를 작성한다.
- 파일 파싱, Domain 규칙, UI 표현을 분리한다.
- TypeScript strict mode를 유지하며 `any`로 경계를 우회하지 않는다.
- 새 패턴은 기존 패턴을 확인한 뒤 도입하고, 사용하지 않는 추상화를 만들지 않는다.

## 디렉터리

- `src/app`: 앱 시작점, 라우팅, 전역 composition
- `src/ui`: 페이지와 표현 컴포넌트
- `src/application`: 사용자 목적 단위 사용 사례
- `src/domain`: 프레임워크와 무관한 타입과 규칙
- `src/infrastructure`: IndexedDB와 파일 Adapter
- `src/shared`: 둘 이상의 영역에서 실제로 재사용하는 작은 코드

처음부터 모든 디렉터리를 만들지 않는다. 기능이 생기는 Commit에서 필요한 경로만 추가한다. 계층 안의 코드가 늘어나면 `transactions`, `imports`, `dashboard`처럼 기능별로 묶는다.

## 이름과 파일

- TypeScript/TSX 파일은 `kebab-case.ts`와 `kebab-case.tsx`를 사용한다.
- React Component, Domain Type, Schema는 `PascalCase`를 사용한다.
- 함수, 변수, 인스턴스는 `camelCase`를 사용한다.
- Hook은 `use`로 시작한다.
- Boolean은 가능한 한 `is`, `has`, `can`, `should`로 시작한다.
- 테스트는 대상 가까이에 `*.test.ts` 또는 `*.test.tsx`로 둔다.
- 하나의 파일은 하나의 주된 책임을 가지며 의미 없는 `utils.ts`에 서로 다른 기능을 모으지 않는다.

## 함수와 Component

- 함수는 동작이 드러나는 동사로 이름 짓고, 입력과 출력을 명시한다.
- React Component는 화면 표현과 상호작용에 집중하고 파싱·집계 규칙을 포함하지 않는다.
- 계산 가능한 상태를 중복 저장하지 않는다.
- Hook은 React 생명주기 또는 상태 조합이 실제로 재사용될 때만 만든다.
- 복잡한 Domain 함수와 공개 경계에는 필요한 경우 JSDoc/TSDoc으로 불변식과 실패 조건을 설명한다.

## Type과 Interface

- 데이터 union과 조합에는 `type`을 기본으로 사용한다.
- TypeScript `enum`보다 직렬화가 명확한 string literal union을 우선한다.
- 구현체가 따라야 하는 실제 포트 계약에는 `interface`를 사용할 수 있다.
- 한 구현체만 있고 교체 요구도 없는 코드에 interface를 미리 만들지 않는다.
- `unknown` 입력은 경계에서 검증해 좁히며, `as` 단언으로 검증을 건너뛰지 않는다.

## Import와 Export

Import 그룹은 빈 줄로 구분해 다음 순서를 사용한다.

1. 외부 패키지
2. 프로젝트 절대 경로
3. 상대 경로
4. 스타일과 정적 자산

- 타입 전용 Import는 `import type`으로 구분한다.
- named export를 기본으로 사용한다. 도구 또는 프레임워크가 요구할 때만 default export를 사용한다.
- 순환 의존성을 만들지 않으며 Domain은 상위 계층을 Import하지 않는다.

## Error Handling

- 잘못된 파일 형식, 행 검증 실패, 중복 후보처럼 예상 가능한 문제는 typed result 또는 issue 목록으로 반환한다.
- 예상하지 못한 프로그래밍 오류와 복구 불가능한 Infrastructure 오류만 예외로 처리한다.
- 사용자 메시지는 해결 행동을 설명하고 내부 stack을 노출하지 않는다.
- 오류 객체, 로그, telemetry에 전체 원본 행·파일 내용·민감한 파일명을 담지 않는다.
- 오류를 조용히 무시하지 않고 호출자가 처리하거나 명시적으로 기록한다.

## Validation

- 파일, 사용자 입력, IndexedDB에서 읽은 값 등 신뢰 경계를 통과하는 데이터는 런타임 검증한다.
- Parser 단계의 Source Record 검증과 Domain Transaction 불변식 검증을 구분한다.
- 여러 행의 오류를 가능한 범위에서 함께 수집해 Preview에서 수정 가능한 위치를 보여준다.
- 검증 라이브러리는 Phase 2에서 실제 스키마 요구를 확인한 뒤 선택한다.
- 파일 확장자와 MIME만 신뢰하지 않고 헤더, 크기, 행 수, 문자열 길이를 제한한다.

## Money

- KRW는 원 단위 정수로 저장하고 계산한다.
- 금액은 `number`의 safe integer 범위만 허용하며 `Number.isSafeInteger`로 검증한다.
- `parseFloat`나 부동소수점 누적 계산으로 돈을 처리하지 않는다.
- Transaction 금액은 양수 `amountMinor`와 별도 `direction`으로 표현한다.
- 서로 다른 통화를 암묵적으로 합산하지 않는다.
- 표시는 UI 경계에서 `Intl.NumberFormat`으로 처리하며 표시 문자열을 계산에 재사용하지 않는다.
- 비율을 계산할 때 반올림 규칙과 0으로 나누는 경우를 테스트한다.

## Date and Time

- 날짜만 있는 거래는 `YYYY-MM-DD` CalendarDate 문자열로 유지한다.
- 날짜 전용 값을 `new Date('YYYY-MM-DD')`로 변환하지 않는다.
- 앱이 생성하는 시각은 UTC ISO 8601 instant로 저장하고 UI에서 사용자 시간대로 표시한다.
- 초기 사용자 표시 시간대는 `Asia/Seoul`이며 설정은 한곳에서 관리한다.
- 월 경계, 윤년, 자정, 시간대 변환을 관련 테스트에 포함한다.
- 주 시작 요일은 Phase 6에서 결정하기 전까지 하드코딩하지 않는다.

## Constants and Magic Values

- Domain 의미가 있는 거래 유형, 통화, 제한값은 이름 있는 상수 또는 literal union으로 정의한다.
- 단 한 번 쓰이고 의미가 분명한 값까지 무조건 상수로 만들지는 않는다.
- 파일 크기나 행 수 제한은 근거와 단위를 이름에 드러낸다.
- 사용자 재무 목표와 개인 수치는 코드 상수로 두지 않는다.

## Comment Policy

- 주석은 구현이 하는 일을 반복하지 않고 금융 도메인 예외, trade-off, 우회 이유와 오해하기 쉬운 불변식을 설명한다.
- 중복 탐지처럼 오탐·미탐이 가능한 로직에는 판정 한계와 사용자 확인 지점을 기록한다.
- TODO에는 해결 조건 또는 관련 계획을 연결한다.
- 오래된 코드를 주석 처리해 보관하지 않고 Git 이력을 사용한다.

## Test Naming and Structure

- 테스트 이름은 `상황에서 기대 결과`가 드러나는 문장으로 작성한다.
- Arrange–Act–Assert 구분이 읽히도록 구성하되 자명한 주석을 반복하지 않는다.
- Domain 규칙은 테이블 기반 경계 사례를 우선 검토한다.
- UI는 구현 세부사항보다 사용자에게 보이는 역할, 이름, 상태로 조회한다.
- 금융 fixture는 `Generic Test Format`임을 명시하고 실제 사람·기관 계정과 무관한 값을 사용한다.
- 금액 부호, 0원, safe integer 경계, 날짜 경계, `UNKNOWN`, `CARD_PAYMENT` 이중 집계를 테스트한다.
- Mock은 외부 경계에만 사용하고 Domain 로직 자체를 Mock하지 않는다.

## 금융 데이터와 개인정보

- 금융기관 ID·비밀번호, 주민등록번호, 공동인증서, 카드 전체 번호를 수집하거나 저장하지 않는다.
- 실제 샘플은 먼저 마스킹하고 `samples/private/`에만 두며 Git에 추가하지 않는다.
- `samples/example/`과 테스트 fixture에는 명백한 가짜 데이터만 둔다.
- 원본 거래 행, 파일 내용, 파일명, 계좌·카드 식별자를 console, 오류, snapshot, analytics에 기록하지 않는다.
- 초기 런타임에는 원격 analytics, telemetry, crash reporting과 외부 CDN 스크립트를 추가하지 않는다.
- UI는 가져온 문자열을 HTML로 삽입하지 않고 텍스트로 렌더링한다.
- 커밋 전 staged 파일과 diff를 확인해 민감한 자료가 포함되지 않았는지 점검한다.

## Git Commit

- 서로 독립적으로 설명 가능한 기능 단위로 커밋한다.
- 제목은 정확히 `[Type] : 커밋 제목` 형식을 사용한다.
- 제목 뒤 빈 줄을 두고 비어 있지 않은 본문에 변경 목적과 주요 범위, 가능하면 검증 결과를 적는다.
- Type은 `Docs`, `Feat`, `Fix`, `Test`, `Refactor`, `Build`, `Chore` 중 맥락에 맞는 값을 우선 사용한다. 새로운 Type이 필요하면 의미가 분명해야 한다.
- 하나의 커밋에 무관한 문서나 기능을 섞지 않는다.
- 사용자가 명시적으로 요청하지 않으면 push하지 않는다.

예:

```text
[Feat] : 거래 빈 상태 대시보드 추가

모바일 화면에서 월간 요약과 최근 거래의 빈 상태를 확인할 수 있게 했습니다.
관련 컴포넌트 테스트와 build 검증을 통과했습니다.
```

## Feature 완료 규칙

1. `docs/plans/current-plan.md`에서 Scope와 Acceptance Criteria를 확인한다.
2. 현재 Phase에 필요한 최소 변경만 구현한다.
3. 가능한 lint, typecheck, test, build와 필요한 사용자 흐름을 검증한다.
4. 실패하면 원인을 분석해 최대 3회까지만 서로 의미 있는 시도를 한다.
5. Review에서 요구 누락, 계층 위반, 개인정보, 과설계를 확인한다.
6. 관련 요구, ADR, 계획, 엔지니어링 로그를 갱신한다.
7. `DONE`, `BLOCKED`, `NEEDS_USER_INPUT` 중 하나로 종료한다.
