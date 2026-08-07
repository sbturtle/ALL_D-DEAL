# ADR-0010 Kakao 키워드 장소 분류 경계

- Status: Accepted
- Date: 2026-08-05
- Refined by: [ADR-0012 Merchant Entity Resolution](ADR-0012-merchant-entity-resolution-before-vector-search.md)

## Context

XLS의 거래처 설명은 가계 금융정보의 일부이므로, 브라우저 환경에는 노출 가능한 JavaScript 키만 둘 수 있다. 따라서 REST API 키나 Admin 키를 프런트엔드에 두지 않고 Kakao Map JavaScript SDK의 키워드 장소 검색만 사용한다.

초기 구현은 이 검색의 주소를 Preview에 보이는 보조 정보로만 사용했다. 그러나 키워드 장소 검색은 `category_name`과 카테고리 그룹, 지번·도로명 주소, 좌표도 돌려주므로, 주소만 표시하면 이 연동의 분류 목적을 달성하지 못한다.

## Decision

- `VITE_KAKAO_MAP_JAVASCRIPT_KEY`로 로드한 Kakao Map Web SDK의 `services.Places.keywordSearch`만 사용한다. REST API key, Admin key, client secret, access token은 `.env.example`, `.env`, 번들, URL, IndexedDB에 넣지 않는다.
- `id`, `place_name`, `category_name`, 카테고리 그룹 코드·이름, 지번·도로명 주소, 좌표를 짧은 내부 DTO로 보존한다. Kakao 원본 응답 전체는 저장하지 않는다.
- `EXPENSE` Preview 후보가 사용자 규칙으로 이미 분류되지 않은 경우에만 거래처 설명을 키워드로 검색한다. 이 ADR의 초기 구현은 정규화한 거래처명과 장소명이 정확히 일치할 때만 제안했다. Phase 8C부터 ADR-0012의 결정적 Alias·제한적 Fuzzy 해석과 canonical query fallback을 적용하되, 장소 동일성·신뢰도·사용자 검토 경계는 더 엄격한 ADR-0012 계약을 따른다.
- PAYCO 오더, 네이버페이, 카카오페이, 토스페이, KG이니시스 같은 결제 중개자 표식은 Kakao 호출 전 제외하고 검토 상태로 둔다. 불일치하거나 미매핑인 결과도 검토 상태로 둔다.
- Preview에는 원본 거래처명, Kakao 카테고리·그룹, 지번·도로명 주소, 최종 제안 카테고리, 출처, 신뢰도를 표시한다. 사용자는 저장 전에 언제나 변경할 수 있고, Kakao 메타데이터는 Transaction에 저장하지 않는다.

## Consequences

- 사용자 규칙이 Kakao 제안보다 항상 우선하며, 현재 저장된 거래처 캐시와 정적 상호 테이블은 도입하지 않았다. 향후 추가 시에도 `사용자 규칙 > 캐시 > 정적 규칙 > Kakao > 검토` 순서를 지켜야 한다.
- API 키나 SDK가 없는 환경에서는 Import와 로컬 저장이 계속 동작하고, Kakao 보조 분류만 비활성화된다.
- REST 키워드 API를 직접 호출해야 한다면 키를 안전하게 보관하는 서버 프록시가 별도 요구사항과 보안 검토를 거쳐 추가되어야 한다.

## Current refinement

Phase 7C부터 Kakao 키가 설정된 경우 사용자의 파일 선택을 시작 신호로 삼아 정확 사용자 규칙이 없는 `EXPENSE` 후보를 자동 분석한다. 파일 선택 전 화면에 상호명 검색어의 외부 전송을 고지하며, 별도 백그라운드 수집이나 저장 거래 재분류는 하지 않는다. Phase 8C의 원문·정규화·canonical 최대 3회 fallback, 결제 중개자 차단과 Preview trace는 [ADR-0012](ADR-0012-merchant-entity-resolution-before-vector-search.md)를 따른다.
