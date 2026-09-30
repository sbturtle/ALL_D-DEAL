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

function renderAt(pathname: string) {
  window.history.replaceState(null, '', pathname);
  return render(<App />);
}

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it.each(['/home', '/'])(
    '%s에서 홈을 열고 현재 하단 메뉴를 표시한다',
    (pathname) => {
      renderAt(pathname);

      expect(
        screen.getByRole('heading', {
          name: '흩어진 금융 기록을 알뜰하게.',
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    },
  );

  it('기존 /ledger 주소를 거래 내역으로 이어서 연다', () => {
    renderAt('/ledger');

    expect(
      screen.getByRole('heading', {
        name: '모든 거래를 한곳에서 확인하세요',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '거래' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(window.location.pathname).toBe('/ledger');
  });

  it('/review에서 분류 검토 화면을 연다', () => {
    renderAt('/review');

    expect(
      screen.getByRole('heading', { name: '분류 검토', level: 1 }),
    ).toBeInTheDocument();
    expect(document.title).toBe('분류 검토 · ALL D·DEAL · 알뜰');
  });

  it('하단 메뉴로 거래 내역을 연다', async () => {
    const user = userEvent.setup();
    renderAt('/home');

    await user.click(screen.getByRole('link', { name: '거래' }));

    expect(
      screen.getByRole('heading', {
        name: '모든 거래를 한곳에서 확인하세요',
      }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/transactions');
  });

  it('빠른 작업에서 금융 데이터 불러오기를 연다', async () => {
    const user = userEvent.setup();
    renderAt('/home');

    await user.click(screen.getByRole('button', { name: '빠른 작업 열기' }));
    const quickActionSheet = screen.getByRole('dialog', {
      name: '무엇을 할까요?',
    });

    expect(quickActionSheet).toBeInTheDocument();
    await user.click(
      screen.getByRole('link', { name: /금융 데이터 불러오기/ }),
    );

    expect(
      screen.getByRole('heading', { name: '이번 주 소비 불러오기' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/미분류 지출의 상호명 검색어만 전송하며/),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: '빠른 작업 열기' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/imports');
  });

  it('급여 계산에서 연봉과 상여·비과세액을 반영한다', async () => {
    const user = userEvent.setup();
    renderAt('/home');

    await user.click(screen.getByRole('link', { name: '급여' }));
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

  it('하단 메뉴로 로컬 설정을 연다', async () => {
    const user = userEvent.setup();
    renderAt('/home');

    await user.click(screen.getByRole('link', { name: '설정' }));

    expect(
      screen.getByRole('heading', { name: /생활비 목표를/, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '설정' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(window.location.pathname).toBe('/settings');
  });

  it('없는 주소는 홈 대신 페이지 없음 화면과 복귀 링크를 보여 준다', async () => {
    const user = userEvent.setup();
    renderAt('/nonexistent');

    expect(
      screen.getByRole('heading', { name: '페이지를 찾을 수 없어요' }),
    ).toBeVisible();
    expect(screen.getByText('/nonexistent')).toBeVisible();
    expect(document.title).toBe('페이지 없음 · ALL D·DEAL · 알뜰');

    await user.click(screen.getByRole('link', { name: '홈으로 가기' }));
    expect(window.location.pathname).toBe('/home');
    expect(
      screen.queryByRole('heading', { name: '페이지를 찾을 수 없어요' }),
    ).not.toBeInTheDocument();
  });

  it('브라우저 뒤로·앞으로에 해당하는 popstate로 화면을 바꾼다', () => {
    renderAt('/transactions');

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
    expect(
      screen.getByRole('heading', { name: '이번 주 소비 불러오기' }),
    ).toBeInTheDocument();
  });
});
