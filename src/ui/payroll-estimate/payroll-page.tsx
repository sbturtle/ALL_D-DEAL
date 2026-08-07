import { PayrollEstimateCalculator } from './payroll-estimate-calculator';
import './payroll-page-refresh.css';

export function PayrollPage() {
  return (
    <section
      className="hero-section payroll-page"
      aria-labelledby="page-title"
    >
      <header className="hero-intro payroll-page__intro">
        <p className="eyebrow">급여 계산</p>
        <h1 id="page-title">
          이번 연봉,
          <br />
          <em>실제로 남는 돈은?</em>
        </h1>
        <p className="hero-description">
          월급과 상여를 함께 넣으면 2026년 기준 예상 실수령액과 공제 내역을
          한눈에 풀어드립니다.
        </p>

        <div className="trust-list" aria-label="계산 방식 안내">
          <span>
            <i aria-hidden="true">✓</i>
            이 기기에서만 계산
          </span>
          <span>
            <i aria-hidden="true">✓</i>
            2026년 공식 기준 반영
          </span>
          <span>
            <i aria-hidden="true">✓</i>
            상여금도 월평균에 포함
          </span>
        </div>

        <p className="hero-footnote">
          일반 직장근로자를 위한 간편 추정이에요. 실제 급여명세서와는 차이가
          있을 수 있습니다.
        </p>
      </header>

      <PayrollEstimateCalculator />
    </section>
  );
}
