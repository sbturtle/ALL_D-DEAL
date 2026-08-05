# Duplicate Candidate Review

- Status: Implemented in Phase 4
- Date: 2026-08-05
- Related: [ADR-0006](../adr/ADR-0006-duplicate-candidates-require-user-confirmation.md)

## 목적

새 Legacy XLS Preview를 확정하기 전에 브라우저에 저장된 거래와 같은 파일의 앞선 후보를 비교해, 이중 저장 가능성을 사용자가 검토할 수 있게 한다. 이 기능은 중복을 확정하거나 기존 원장을 변경하지 않는다.

## v1 비교 지문

비교 지문은 아래 필드를 순서대로 직렬화하고 64-bit FNV-1a 해시를 적용한 `v1:<hex>` 값이다.

1. `occurredOn`
2. `amountMinor`
3. `currency`
4. `direction`
5. `type`
6. 정규화한 `descriptionOriginal`

설명 정규화는 Unicode NFKC, 소문자화, 문장부호·기호 제거, 공백 축소와 앞뒤 공백 제거 순서다. `paymentInstrumentLabel`은 계좌 거래에 없을 수 있으므로 비교에 넣지 않는다.

이 지문은 암호화도 아니고 거래 동일성의 증명도 아니다. 해시 충돌, 동일한 날짜의 반복 결제, Importer 해석 차이 때문에 지문이 같더라도 **중복 가능성**으로만 취급한다.

## 감지와 확인 흐름

```text
XLS Preview 생성
  → IndexedDB의 저장 Transaction 전체를 읽음
  → 저장 거래 및 Preview의 앞선 후보와 v1 지문 비교
  → 중복 가능 후보를 기본 저장 선택에서 제외
  → 사용자: 후보별 재포함 또는 전체 재포함
  → 선택 후보만 ImportBatch + Transaction 원자 저장
```

비교 결과는 후보 인덱스, 저장 거래 ID 목록, 같은 Preview의 앞선 후보 인덱스만 전달한다. UI에는 저장 거래의 설명·금액·식별자를 새로 노출하지 않는다. 비교 실패 시 저장을 비활성화하고 파일을 다시 선택하게 하며, 오류에 원본 행이나 파일 이름을 포함하지 않는다.

## 저장 경계

- v1 지문과 정규화 설명은 메모리에만 존재하고 IndexedDB에는 저장하지 않는다.
- IndexedDB 스키마는 v1을 유지한다. `transactions`, `importBatches`, `budgetSettlements`에는 새 필드나 인덱스를 추가하지 않는다.
- 사용자가 제외한 수는 실제 저장이 수행될 때 `ImportBatch.skippedCount`에 기록한다. `reviewedCount = newCount + skippedCount`다.
- 기존 `Transaction`은 삭제·병합·대체·수정하지 않는다.

## 재검토 조건

저장 거래 전체를 메모리에서 비교하는 비용이 실제 사용 환경에서 문제가 되거나, 퍼지 매칭·영속 인덱스가 필요해지면 별도 ADR과 IndexedDB 마이그레이션을 먼저 작성한다.
