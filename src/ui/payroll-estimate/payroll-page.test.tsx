import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PayrollPage } from './payroll-page';

describe('PayrollPage', () => {
  it('keeps calculation results, deductions, focus, and policy sources available', async () => {
    const user = userEvent.setup();
    render(<PayrollPage />);

    expect(
      screen.getByRole('heading', {
        name: '이번 연봉, 실제로 남는 돈은?',
        level: 1,
      }),
    ).toBeVisible();
    expect(screen.getByText('이 기기에서만 계산')).toBeVisible();

    await user.type(
      screen.getByRole('textbox', { name: '세전 기본 연봉' }),
      '48000000',
    );
    await user.type(
      screen.getByRole('textbox', { name: '연간 상여금' }),
      '6000000',
    );
    await user.click(
      screen.getByRole('button', { name: '예상 실수령액 계산' }),
    );

    const resultPanel = screen.getByRole('complementary', {
      name: '급여 추정 결과',
    });
    const resultHeading = within(resultPanel).getByRole('heading', {
      level: 2,
      name: /원$/,
    });

    expect(resultHeading).toHaveFocus();
    expect(within(resultPanel).getByText('상여 포함 연 세전')).toBeVisible();
    expect(within(resultPanel).getByText('국민연금')).toBeVisible();
    expect(within(resultPanel).getByText('지방소득세')).toBeVisible();

    await user.click(
      within(resultPanel).getByText('계산 기준과 꼭 알아둘 점'),
    );
    expect(
      within(resultPanel).getByRole('link', {
        name: /근로소득 간이세액표 · 국가법령정보센터/,
      }),
    ).toHaveAttribute('target', '_blank');
  });
});
