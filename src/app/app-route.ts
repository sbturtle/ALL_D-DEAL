export const APP_ROUTE_PATHS = {
  LEDGER: '/ledger',
  IMPORTS: '/imports',
  PAYROLL: '/payroll',
} as const;

export type AppRoute = keyof typeof APP_ROUTE_PATHS;

export function getAppRoute(pathname: string): AppRoute {
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';

  if (normalizedPathname === APP_ROUTE_PATHS.IMPORTS) {
    return 'IMPORTS';
  }

  if (normalizedPathname === APP_ROUTE_PATHS.PAYROLL) {
    return 'PAYROLL';
  }

  return 'LEDGER';
}

export function getAppRoutePath(route: AppRoute): string {
  return APP_ROUTE_PATHS[route];
}
