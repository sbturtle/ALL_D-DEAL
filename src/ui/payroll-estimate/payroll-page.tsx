import { PayrollEstimateCalculator } from './payroll-estimate-calculator';

export function PayrollPage() {
  return (
    <section className="hero-section" aria-labelledby="page-title">
      <div className="hero-intro">
        <p className="eyebrow">PAYCHECK, DECODED</p>
        <h1 id="page-title">
          이번 연봉,
          <br />
          <em>실제로 남는 돈은?</em>
        </h1>
        <p className="hero-description">
          월급과 상여를 함께 넣으면 2026년 기준 예상 실수령액과 공제 내역을
          한눈에 풀어드립니다.
        </p>

        <div className="trust-list" aria-label="계산기 특징">
          <span>
            <i aria-hidden="true">01</i>
            외부 전송 없음
          </span>
          <span>
            <i aria-hidden="true">02</i>
            공식 세액표 반영
          </span>
          <span>
            <i aria-hidden="true">03</i>
            상여 월평균 포함
          </span>
        </div>

        <p className="hero-footnote">
          정확한 급여명세서가 아닌 일반 직장근로자용 간편 추정입니다.
        </p>
      </div>

      <PayrollEstimateCalculator />
    </section>
  );
}
