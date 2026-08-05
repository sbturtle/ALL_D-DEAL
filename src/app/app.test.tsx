import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from './app';

async function enterMoney(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string,
) {
  const input = screen.getByRole('textbox', { name: label });

  await user.clear(input);
  await user.type(input, value);

  return input;
}

describe('App', () => {
  it('계산 전에는 급여 입력과 실제 거래의 빈 상태를 구분해 보여준다', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: '이번 연봉, 실제로 남는 돈은?',
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('급여 조건을 입력해 주세요')).toBeInTheDocument();
    expect(
      screen.getByText('아직 연결된 거래가 없습니다'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/월평균 예상 실수령액/)).not.toBeInTheDocument();
  });

  it('연봉과 상여·비과세액을 반영하고 결과 제목으로 포커스를 옮긴다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await enterMoney(user, '세전 기본 연봉', '48000000');
    await enterMoney(user, '연간 상여금', '12000000');
    await enterMoney(user, '월 비과세액', '200000');
    await user.click(screen.getByRole('button', { name: '예상 실수령액 계산' }));

    const resultHeading = screen.getByRole('heading', {
      name: '4,195,410원',
      level: 2,
    });

    expect(resultHeading).toHaveFocus();
    expect(screen.getByText('50,344,920원')).toBeInTheDocument();
    expect(screen.getByText('60,000,000원')).toBeInTheDocument();
    expect(screen.getByText('804,590원')).toBeInTheDocument();
    expect(screen.getByText('국민연금')).toBeInTheDocument();
    expect(screen.getByText('지방소득세')).toBeInTheDocument();
    expect(screen.getByText(/월평균 추정/)).toBeInTheDocument();

    await user.click(screen.getByText('계산 기준과 꼭 알아둘 점'));

    expect(screen.getByText('2026.07.01')).toBeVisible();
    expect(
      screen.getByText('입력값과 결과는 현재 화면에서만 사용하며 저장하지 않습니다.'),
    ).toBeVisible();
  });

  it('연봉과 월급 입력을 모드별로 따로 기억해 숫자를 재해석하지 않는다', async () => {
    const user = userEvent.setup();
    render(<App />);

    const annualInput = await enterMoney(user, '세전 기본 연봉', '48000000');
    expect(annualInput).toHaveValue('48,000,000');

    await user.click(screen.getByRole('button', { name: '월급으로 계산' }));
    const monthlyInput = await enterMoney(user, '월 세전 기본급', '4000000');
    expect(monthlyInput).toHaveValue('4,000,000');

    await user.click(screen.getByRole('button', { name: '연봉으로 계산' }));
    expect(screen.getByRole('textbox', { name: '세전 기본 연봉' })).toHaveValue(
      '48,000,000',
    );

    await user.click(screen.getByRole('button', { name: '월급으로 계산' }));
    expect(screen.getByRole('textbox', { name: '월 세전 기본급' })).toHaveValue(
      '4,000,000',
    );
  });

  it('지원 범위보다 낮은 월급을 필드 오류로 알리고 결과를 만들지 않는다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '월급으로 계산' }));
    const monthlyInput = await enterMoney(user, '월 세전 기본급', '400000');
    await user.click(screen.getByRole('button', { name: '예상 실수령액 계산' }));

    expect(monthlyInput).toHaveAttribute('aria-invalid', 'true');
    expect(monthlyInput).toHaveFocus();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '월 환산 기본 급여 410,000원부터 지원합니다',
    );
    expect(
      screen.queryByRole('heading', { name: /원$/, level: 2 }),
    ).not.toBeInTheDocument();
  });

  it('초기화하면 모든 급여 입력과 계산 결과를 제거한다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await enterMoney(user, '세전 기본 연봉', '48000000');
    await user.click(screen.getByRole('button', { name: '예상 실수령액 계산' }));
    expect(screen.getByText('월평균 예상 실수령액')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '초기화' }));

    expect(screen.getByRole('textbox', { name: '세전 기본 연봉' })).toHaveValue(
      '',
    );
    expect(screen.getByRole('textbox', { name: '연간 상여금' })).toHaveValue(
      '0',
    );
    expect(screen.getByText('급여 조건을 입력해 주세요')).toBeInTheDocument();
    expect(screen.queryByText('월평균 예상 실수령액')).not.toBeInTheDocument();
  });

  it('예시 거래는 Mock임을 표시하고 실제 빈 장부로 돌아갈 수 있다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: '예시 데이터 보기' }));

    expect(screen.getByRole('status')).toHaveTextContent('Mock Data');
    expect(screen.getByText('예시 급여')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '빈 장부' }));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('아직 연결된 거래가 없습니다')).toBeInTheDocument();
  });
});
