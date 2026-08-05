# ADR-0005 — 수동 단체 결제 정산과 순생활비 집계

- Status: Accepted
- Date: 2026-08-05

## Context

한 사람이 단체 결제 전체를 먼저 출금하고, 다른 참여자에게서 정산 입금을 받는 거래가 있다. 원결제 출금 전체를 생활비에 넣으면 사용자의 실제 부담보다 목표 사용액이 커진다. 반대로 입금을 삭제하거나 출금 거래 금액을 수정하면 실제 원장과 잔액의 의미가 달라진다.

## Decision

브라우저 IndexedDB에 `BudgetSettlement`을 별도 저장한다. 이 레코드는 한 개의 payer outflow transaction ID와 하나 이상의 reimbursement inflow transaction ID를 가진다. 연결은 사용자가 직접 만들고 제거한다; 날짜, 금액, 설명의 유사도만으로 자동 연결하지 않는다.

생활비 집계는 선택 기간 안의 일반 `EXPENSE + OUTFLOW`를 합산하고, 그중 정산 payer는 제외한 뒤 payer의 날짜가 범위 안인 각 정산에 `max(payer.amountMinor - reimbursements.amountMinor 합계, 0)`를 더한다. 연결한 입금은 그 자체로 생활비에 더하거나 빼지 않는다. 따라서 정산금이 나중에 들어와도 부담액은 원결제 날짜에 귀속된다.

`BudgetSettlement`은 원본 `Transaction`을 변경하지 않는다. 일반 입출금, 잔액, ImportBatch 추적은 그대로 유지한다.

## Consequences

- 생활비 목표의 실제 부담액과 현금흐름 원장을 동시에 보존한다.
- `UNKNOWN + OUTFLOW`도 사용자가 명시적으로 payer로 선택한 경우 정산의 원결제가 될 수 있다.
- 부분 정산, 과다 정산, 다음 달 입금은 모두 계산 가능하다. 과다 정산은 생활비를 음수로 만들지 않는다.
- 자동 추천, 분할 결제, 환불과의 관계, 거래 타입 일괄 수정은 별도 요구가 확인될 때 추가한다.

## Alternatives considered

- 입금 거래를 생활비 지출에서 단순 차감: 다른 입금의 의미를 잃고 선택 근거가 불명확하다.
- 원결제 금액을 수정: 실제 원장·잔액과 불일치한다.
- 거래 설명과 금액으로 자동 매칭: 이체·급여·환불을 잘못 연결할 위험이 크다.
