import { describe, expect, it } from 'vitest';

import { getAppRoute, getAppRoutePath } from './app-route';

describe('app routes', () => {
  it.each([
    ['/', 'LEDGER'],
    ['/ledger', 'LEDGER'],
    ['/ledger/', 'LEDGER'],
    ['/imports', 'IMPORTS'],
    ['/payroll', 'PAYROLL'],
    ['/unknown', 'LEDGER'],
  ] as const)('maps %s to %s', (pathname, expectedRoute) => {
    expect(getAppRoute(pathname)).toBe(expectedRoute);
  });

  it('returns a stable path for every supported route', () => {
    expect(getAppRoutePath('LEDGER')).toBe('/ledger');
    expect(getAppRoutePath('IMPORTS')).toBe('/imports');
    expect(getAppRoutePath('PAYROLL')).toBe('/payroll');
  });
});
