import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

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
  beforeEach(() => {
    window.history.replaceState(null, '', '/ledger');
  });

  it('처음에는 장부만 보여주고 현재 페이지 탐색을 표시한다', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: '저장한 거래를 기간별로 확인하세요' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '장부' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.queryByRole('heading', {
        name: '이번 연봉, 실제로 남는 돈은?',
        level: 1,
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('내 XLS 파일 미리보기')).not.toBeInTheDocument();
  });

  it('급여 계산 페이지에서 연봉과 상여·비과세액을 반영한다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: '급여 계산' }));
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
    expect(window.location.pathname).toBe('/payroll');
  });

  it('XLS 가져오기 페이지를 독립적으로 연다', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('link', { name: 'XLS 가져오기' }));

    expect(
      screen.getByRole('heading', { name: '이번 주 거래, 확인하고 장부에 넣기.' }),
    ).toBeInTheDocument();
    expect(screen.getByText('내 XLS 파일 미리보기')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: '저장한 거래를 기간별로 확인하세요' }),
    ).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/imports');
  });

  it('브라우저 뒤로·앞으로에 해당하는 popstate로 화면을 바꾼다', () => {
    render(<App />);

    window.history.pushState(null, '', '/payroll');
    fireEvent.popState(window);
    expect(
      screen.getByRole('heading', {
        name: '이번 연봉, 실제로 남는 돈은?',
        level: 1,
      }),
    ).toBeInTheDocument();

    window.history.pushState(null, '', '/imports');
    fireEvent.popState(window);
    expect(screen.getByText('내 XLS 파일 미리보기')).toBeInTheDocument();
  });
});
