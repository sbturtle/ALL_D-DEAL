# Architecture Decision Records

ADR은 기술 선택뿐 아니라 중요한 제품 요구가 왜 바뀌었는지를 기록한다. 새 결정은 다음 번호를 사용하고, 기존 결정을 대체하면 원 ADR의 상태를 `Superseded`로 바꾸고 후속 ADR을 연결한다.

| ADR                                                                      | 상태     | 결정                                                                      |
| ------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------- |
| [ADR-0001](ADR-0001-file-import-over-financial-api.md)                   | Accepted | 금융 API 직접 연동보다 사용자 주도 파일 Import를 우선한다.                |
| [ADR-0002](ADR-0002-local-first-architecture.md)                         | Accepted | 초기 금융 데이터 처리와 저장을 브라우저 내부로 제한한다.                  |
| [ADR-0003](ADR-0003-weekly-import-instead-of-realtime.md)                | Accepted | 실시간 동기화보다 주 1회 검토 흐름을 최적화한다.                          |
| [ADR-0004](ADR-0004-versioned-local-payroll-estimation.md)               | Accepted | 공식 근거를 버전으로 고정한 급여 추정 정책을 브라우저에서 실행한다.       |
| [ADR-0005](ADR-0005-manual-shared-payment-settlements.md)                | Accepted | 수동 정산 연결로 원장을 보존하며 생활비는 순지출로 집계한다.              |
| [ADR-0006](ADR-0006-duplicate-candidates-require-user-confirmation.md)   | Accepted | 중복 가능 후보는 기본 제외하고 사용자의 명시적 재포함 후에만 저장한다.    |
| [ADR-0007](ADR-0007-confirmed-description-category-rules.md)             | Accepted | 명시적으로 동의한 거래 설명 카테고리 규칙만 Preview에 재사용한다.         |
| [ADR-0008](ADR-0008-client-routes-for-financial-workflows.md)            | Accepted | 금융 작업 목적별 클라이언트 경로를 작은 자체 라우터로 분리한다.           |
| [ADR-0009](ADR-0009-card-expense-and-account-cashflow-classification.md) | Accepted | 카드 사용은 소비로, 계좌 거래는 유형 분류가 우선인 현금흐름으로 처리한다. |
| [ADR-0010](ADR-0010-kakao-map-web-sdk-opt-in-boundary.md)                | Accepted | Kakao 장소 검색은 Web SDK, 사전 고지와 Preview 전용 결과로 제한한다.      |
| [ADR-0011](ADR-0011-local-monthly-living-expense-goal.md)                | Accepted | 월 생활비 목표는 단일 로컬 설정으로 저장하고 월간 순생활비와만 비교한다.  |
| [ADR-0012](ADR-0012-merchant-entity-resolution-before-vector-search.md)  | Accepted | Vector Search보다 결정적 Merchant Entity Resolution을 먼저 적용한다.      |
| [ADR-0013](ADR-0013-confirmed-local-ledger-reset.md)                     | Accepted | 범위를 고지하고 재확인한 뒤에만 브라우저 로컬 장부를 초기화한다.          |
| [ADR-0014](ADR-0014-many-to-many-shared-payment-settlements.md)           | Accepted | 여러 지출과 여러 입금을 하나의 공동결제 정산으로 연결한다.                |

## 새 ADR 기본 구조

```text
상태
최초 사용자 요구
이후 대화에서 확인된 문제
변경된 요구사항
결정
결정 이유
고려한 대안
장점
단점
향후 다시 검토할 조건
```
