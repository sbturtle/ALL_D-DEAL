import { describe, expect, it } from 'vitest';

import { getAppRoute, getAppRoutePath } from './app-route';

describe('app routes', () => {
  it.each([
    ['/', 'HOME'],
    ['/home', 'HOME'],
    ['/home/', 'HOME'],
    ['/transactions', 'TRANSACTIONS'],
    ['/transactions/', 'TRANSACTIONS'],
    ['/ledger', 'TRANSACTIONS'],
    ['/ledger/', 'TRANSACTIONS'],
    ['/review', 'REVIEW'],
    ['/imports', 'IMPORTS'],
    ['/payroll', 'PAYROLL'],
    ['/settings', 'SETTINGS'],
    ['/unknown', 'HOME'],
  ] as const)('maps %s to %s', (pathname, expectedRoute) => {
    expect(getAppRoute(pathname)).toBe(expectedRoute);
  });

  it('returns a stable path for every supported route', () => {
    expect(getAppRoutePath('HOME')).toBe('/home');
    expect(getAppRoutePath('TRANSACTIONS')).toBe('/transactions');
    expect(getAppRoutePath('REVIEW')).toBe('/review');
    expect(getAppRoutePath('IMPORTS')).toBe('/imports');
    expect(getAppRoutePath('PAYROLL')).toBe('/payroll');
    expect(getAppRoutePath('SETTINGS')).toBe('/settings');
  });
});
