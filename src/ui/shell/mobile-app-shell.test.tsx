import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AppNavigationHandler } from './mobile-app-shell';
import { MobileAppShell } from './mobile-app-shell';

function createNavigationHandler() {
  return vi.fn<AppNavigationHandler>((event) => event.preventDefault());
}

describe('MobileAppShell', () => {
  it('shows the current screen and four implemented primary destinations', async () => {
    const user = userEvent.setup();
    const onNavigate = createNavigationHandler();

    render(
      <MobileAppShell currentRoute="HOME" onNavigate={onNavigate}>
        <h1>이번 달 생활비</h1>
      </MobileAppShell>,
    );

    expect(screen.getByText('이번 달 생활비')).toBeVisible();
    expect(screen.getByText('ALL D·DEAL')).toBeVisible();
    expect(screen.getByText('알뜰')).toBeVisible();
    expect(screen.getByText('홈', { selector: '.mobile-app-bar__title' })).toBeVisible();

    const navigation = screen.getByRole('navigation', {
      name: '하단 주요 메뉴',
    });
    expect(navigation).toBeVisible();
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '거래' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.queryByRole('link', { name: '소비 불러오기' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '거래' }));

    expect(onNavigate).toHaveBeenCalledWith(
      expect.any(Object),
      'TRANSACTIONS',
    );
  });

  it('opens the quick-action dialog, focuses its primary action, and restores FAB focus on Escape', async () => {
    const user = userEvent.setup();

    render(
      <MobileAppShell
        currentRoute="TRANSACTIONS"
        onNavigate={createNavigationHandler()}
      >
        <h1>거래 내역</h1>
      </MobileAppShell>,
    );

    const fab = screen.getByRole('button', { name: '빠른 작업 열기' });
    await user.click(fab);

    expect(fab).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('dialog', { name: '무엇을 할까요?' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /금융 데이터 불러오기/ }),
    ).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fab).toHaveFocus();
    expect(fab).toHaveAttribute('aria-expanded', 'false');
  });

  it('navigates through an existing quick action and closes the sheet', async () => {
    const user = userEvent.setup();
    const onNavigate = createNavigationHandler();

    render(
      <MobileAppShell currentRoute="TRANSACTIONS" onNavigate={onNavigate}>
        <h1>거래 내역</h1>
      </MobileAppShell>,
    );

    await user.click(screen.getByRole('button', { name: '빠른 작업 열기' }));
    await user.click(
      screen.getByRole('link', { name: /금융 데이터 불러오기/ }),
    );

    expect(onNavigate).toHaveBeenCalledWith(expect.any(Object), 'IMPORTS');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes from the explicit close control and returns focus', async () => {
    const user = userEvent.setup();

    render(
      <MobileAppShell currentRoute="HOME" onNavigate={createNavigationHandler()}>
        <h1>홈</h1>
      </MobileAppShell>,
    );

    const fab = screen.getByRole('button', { name: '빠른 작업 열기' });
    await user.click(fab);
    await user.click(
      screen.getByRole('button', { name: '빠른 작업 닫기' }),
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fab).toHaveFocus();
  });

  it('keeps the FAB away from focused payroll, import, and settings workflows', () => {
    const onNavigate = createNavigationHandler();
    const { rerender } = render(
      <MobileAppShell currentRoute="PAYROLL" onNavigate={onNavigate}>
        <h1>급여 계산</h1>
      </MobileAppShell>,
    );

    expect(
      screen.queryByRole('button', { name: '빠른 작업 열기' }),
    ).not.toBeInTheDocument();

    rerender(
      <MobileAppShell currentRoute="IMPORTS" onNavigate={onNavigate}>
        <h1>소비 불러오기</h1>
      </MobileAppShell>,
    );
    expect(
      screen.queryByRole('button', { name: '빠른 작업 열기' }),
    ).not.toBeInTheDocument();

    rerender(
      <MobileAppShell currentRoute="SETTINGS" onNavigate={onNavigate}>
        <h1>설정</h1>
      </MobileAppShell>,
    );
    expect(
      screen.queryByRole('button', { name: '빠른 작업 열기' }),
    ).not.toBeInTheDocument();
  });

  it('moves focus to the new screen content after route changes', () => {
    const onNavigate = createNavigationHandler();
    const { rerender } = render(
      <MobileAppShell currentRoute="HOME" onNavigate={onNavigate}>
        <h1>홈</h1>
      </MobileAppShell>,
    );

    rerender(
      <MobileAppShell currentRoute="TRANSACTIONS" onNavigate={onNavigate}>
        <h1>거래 내역</h1>
      </MobileAppShell>,
    );

    expect(document.querySelector('#app-main-content')).toHaveFocus();
  });
});
