export const APP_ROUTE_PATHS = {
  HOME: '/home',
  TRANSACTIONS: '/transactions',
  REVIEW: '/review',
  IMPORTS: '/imports',
  PAYROLL: '/payroll',
  SETTINGS: '/settings',
} as const;

export type AppRoute = keyof typeof APP_ROUTE_PATHS;

export const APP_ROUTE_TITLES: Readonly<Record<AppRoute, string>> = {
  HOME: '홈',
  TRANSACTIONS: '거래 내역',
  REVIEW: '분류 검토',
  IMPORTS: '소비 불러오기',
  PAYROLL: '급여 계산',
  SETTINGS: '설정',
};

export function getAppRoute(pathname: string): AppRoute {
  const normalizedPathname = pathname.replace(/\/+$/, '') || '/';

  if (
    normalizedPathname === '/' ||
    normalizedPathname === APP_ROUTE_PATHS.HOME
  ) {
    return 'HOME';
  }

  if (
    normalizedPathname === '/ledger' ||
    normalizedPathname === APP_ROUTE_PATHS.TRANSACTIONS
  ) {
    return 'TRANSACTIONS';
  }

  if (normalizedPathname === APP_ROUTE_PATHS.REVIEW) {
    return 'REVIEW';
  }

  if (normalizedPathname === APP_ROUTE_PATHS.IMPORTS) {
    return 'IMPORTS';
  }

  if (normalizedPathname === APP_ROUTE_PATHS.PAYROLL) {
    return 'PAYROLL';
  }

  if (normalizedPathname === APP_ROUTE_PATHS.SETTINGS) {
    return 'SETTINGS';
  }

  return 'HOME';
}

export function getAppRoutePath(route: AppRoute): string {
  return APP_ROUTE_PATHS[route];
}
