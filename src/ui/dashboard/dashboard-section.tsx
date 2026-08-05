import { useState } from 'react';

import { formatWon } from '../../shared/format/currency';
import {
  dashboardMockSummary,
  dashboardMockTransactions,
} from './dashboard-fixtures';

type DashboardMode = 'EMPTY' | 'MOCK';

export function DashboardSection() {
  const [mode, setMode] = useState<DashboardMode>('EMPTY');
  const isMock = mode === 'MOCK';

  return (
    <section className="ledger-section" id="ledger" aria-labelledby="ledger-title">
      <div className="section-heading ledger-heading">
        <div>
          <p className="eyebrow">NEXT · WEEKLY LEDGER</p>
          <h2 id="ledger-title">계산에서 실제 기록으로</h2>
          <p>
            급여 추정값과 실제 수입은 섞지 않습니다. 파일 Import가 준비되면
            확인된 거래만 장부에 반영합니다.
          </p>
        </div>

        <div className="view-switch" aria-label="Dashboard 보기 선택">
          <button
            type="button"
            className={!isMock ? 'is-active' : undefined}
            aria-pressed={!isMock}
            onClick={() => setMode('EMPTY')}
          >
            빈 장부
          </button>
          <button
            type="button"
            className={isMock ? 'is-active' : undefined}
            aria-pressed={isMock}
            onClick={() => setMode('MOCK')}
          >
            예시 데이터 보기
          </button>
        </div>
      </div>

      {isMock ? (
        <div className="mock-notice" role="status">
          <span aria-hidden="true">●</span>
          Mock Data · 아래 금액과 거래는 화면 확인용 가짜 데이터입니다.
        </div>
      ) : null}

      <div className="ledger-grid">
        <div className="ledger-main">
          <div className="summary-grid" aria-label="이번 달 요약">
            {isMock
              ? dashboardMockSummary.map((item) => (
                  <article
                    className={`summary-card summary-card--${item.tone}`}
                    key={item.label}
                  >
                    <span>{item.label}</span>
                    <strong>{formatWon(item.valueWon)}</strong>
                    <small>{item.detail}</small>
                  </article>
                ))
              : ['이번 달 수입', '생활비 사용', '저축'].map((label) => (
                  <article className="summary-card is-empty" key={label}>
                    <span>{label}</span>
                    <strong aria-label={`${label} 데이터 없음`}>—</strong>
                    <small>확인된 거래 없음</small>
                  </article>
                ))}
          </div>

          <article className="transactions-panel">
            <div className="panel-heading">
              <div>
                <p className="panel-kicker">RECENT</p>
                <h3>최근 거래</h3>
              </div>
              <span>{isMock ? '3건 · Mock' : '0건'}</span>
            </div>

            {isMock ? (
              <ul className="transaction-list">
                {dashboardMockTransactions.map((transaction) => (
                  <li key={transaction.id}>
                    <span className="transaction-mark" aria-hidden="true">
                      {transaction.direction === 'IN' ? '↙' : '↗'}
                    </span>
                    <span className="transaction-copy">
                      <strong>{transaction.description}</strong>
                      <small>{transaction.category}</small>
                    </span>
                    <strong
                      className={
                        transaction.direction === 'IN'
                          ? 'amount amount--income'
                          : 'amount'
                      }
                    >
                      {transaction.direction === 'IN' ? '+' : '−'}
                      {formatWon(transaction.amountWon)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-transactions">
                <span className="empty-icon" aria-hidden="true">
                  ↳
                </span>
                <div>
                  <strong>아직 연결된 거래가 없습니다</strong>
                  <p>
                    Phase 3에서 파일을 가져오고 검토한 뒤에만 여기에 표시합니다.
                  </p>
                </div>
              </div>
            )}
          </article>
        </div>

        <aside className="import-card" aria-labelledby="import-title">
          <span className="status-pill">준비 중 · Phase 3</span>
          <p className="panel-kicker">IMPORT</p>
          <h3 id="import-title">내 금융 파일 가져오기</h3>
          <p>
            CSV부터 시작해 저장 전에 신규 거래와 문제를 직접 확인하는 흐름을
            준비하고 있습니다.
          </p>
          <div className="import-flow" aria-label="예정된 가져오기 흐름">
            <span>파일 선택</span>
            <i aria-hidden="true">→</i>
            <span>미리보기</span>
            <i aria-hidden="true">→</i>
            <span>로컬 저장</span>
          </div>
          <button type="button" disabled>
            아직 사용할 수 없어요
          </button>
          <small>금융 데이터는 외부 서버로 전송하지 않을 계획입니다.</small>
        </aside>
      </div>
    </section>
  );
}
