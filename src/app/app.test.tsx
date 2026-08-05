import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './app';

describe('App', () => {
  it('Phase 1 준비 화면을 표시한다', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { name: '가계부' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/급여 실수령 추정기/)).toBeInTheDocument();
  });
});
