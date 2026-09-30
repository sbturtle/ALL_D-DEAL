# 향후 아이디어

현재 범위 밖의 아이디어를 잊지 않되 선행 구현하지 않기 위한 목록이다. 실제 작업으로 옮길 때 별도 계획과 필요하면 ADR을 작성한다.

- Galaxy Chrome 사용성 검증 후 PWA 도입
- 웹 MVP 검증 후 Capacitor, React Native, Native Android 비교
- 멀티디바이스 요구가 생길 때 선택적 암호화 동기화와 백엔드 검토
- Normalize + Alias + 제한적 Fuzzy + Kakao 이후에도 의미 기반 분류 문제가 fixture로 충분히 측정된 뒤 Vector/Embedding 또는 보조적 AI 분류 검토. 2026-09-30 PC Chrome 내장 AI(Gemini Nano) 가짜 fixture 실험 결과는 엔지니어링 로그에 있으며, 채택 전에 실제 미분류 설명으로 브라우저 안에서만 다시 측정한다.
- 금융 파일 Adapter 확장과 형식별 진단 도구
- 데이터 내보내기, 백업, 복구 전략
- 사용자가 직접 관리하는 본인 계좌 별칭과 `SELF_TRANSFER` 검토·확정 흐름
- 사용자가 직접 관리·삭제할 수 있는 Merchant Alias, 성공 Merchant Cache와 보존 정책
- 실제 실패 fixture를 근거로 한 법인 wrapper·영업 suffix 처리, 확장 지출 카테고리와 사용자 정의 카테고리
- 외부 제공자 연동은 Kakao 등 제공 범위·이용약관·인증 방식·최소 권한·보관 정책을 검토한 뒤 mock/adapter부터 설계
- 금융기관 웹의 XLS 다운로드를 반복하는 선택적 로컬 수집기(전용 Chrome 프로필 + Playwright). 실제 기관 한 곳에서 세션 유지 시간, 자동화 차단, 약관을 먼저 확인하고 ADR-0001 경계를 바꾸는 ADR로 결정한다. 2026-09-30 외부 적용 스크립트 검토 내용은 엔지니어링 로그에 있다.
- 로컬 금융 폴더 핸들을 IndexedDB에 기억해 매번 폴더를 고르지 않아도 되는 불러오기와 권한 재확인 흐름
