import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react';

import {
  APP_ROUTE_TITLES,
  getAppRoutePath,
  type AppRoute,
} from '../../app/app-route';
import { AppIcon, type AppIconName } from './app-icon';

const BOTTOM_NAVIGATION_ITEMS: readonly Readonly<{
  route: AppRoute;
  label: string;
  icon: AppIconName;
}>[] = [
  { route: 'HOME', label: '홈', icon: 'home' },
  { route: 'TRANSACTIONS', label: '거래', icon: 'transactions' },
  { route: 'PAYROLL', label: '급여', icon: 'payroll' },
  { route: 'SETTINGS', label: '설정', icon: 'settings' },
];

const QUICK_ACTION_ITEMS: readonly Readonly<{
  route: AppRoute;
  label: string;
  description: string;
  icon: AppIconName;
}>[] = [
  {
    route: 'IMPORTS',
    label: '금융 데이터 불러오기',
    description: '카드·계좌 XLS 파일을 확인하고 저장해요.',
    icon: 'upload',
  },
  {
    route: 'TRANSACTIONS',
    label: '저장한 거래 확인하기',
    description: '카테고리와 메모, 공동결제 정산을 확인해요.',
    icon: 'review',
  },
];

export type AppNavigationHandler = (
  event: MouseEvent<HTMLAnchorElement>,
  route: AppRoute,
) => void;

type MobileAppShellProps = Readonly<{
  currentRoute: AppRoute;
  onNavigate: AppNavigationHandler;
  children: ReactNode;
}>;

function getFocusableElements(container: HTMLElement): readonly HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

export function MobileAppShell({
  currentRoute,
  onNavigate,
  children,
}: MobileAppShellProps) {
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const fabRef = useRef<HTMLButtonElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const previousRouteRef = useRef(currentRoute);
  const sheetRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLAnchorElement>(null);
  const shouldRestoreFabFocus = useRef(false);

  const closeQuickActions = useCallback(() => {
    shouldRestoreFabFocus.current = true;
    setIsQuickActionOpen(false);
  }, []);

  useEffect(() => {
    if (isQuickActionOpen) {
      firstActionRef.current?.focus();
      return;
    }

    if (shouldRestoreFabFocus.current) {
      shouldRestoreFabFocus.current = false;
      fabRef.current?.focus();
    }
  }, [isQuickActionOpen]);

  useEffect(() => {
    if (!isQuickActionOpen) {
      return undefined;
    }

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeQuickActions();
        return;
      }

      if (event.key !== 'Tab' || sheetRef.current === null) {
        return;
      }

      const focusableElements = getFocusableElements(sheetRef.current);
      const firstFocusableElement = focusableElements.at(0);
      const lastFocusableElement = focusableElements.at(-1);

      if (
        event.shiftKey &&
        document.activeElement === firstFocusableElement &&
        lastFocusableElement !== undefined
      ) {
        event.preventDefault();
        lastFocusableElement.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === lastFocusableElement &&
        firstFocusableElement !== undefined
      ) {
        event.preventDefault();
        firstFocusableElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeQuickActions, isQuickActionOpen]);

  useEffect(() => {
    if (previousRouteRef.current === currentRoute) {
      return;
    }

    previousRouteRef.current = currentRoute;
    mainContentRef.current?.focus();
  }, [currentRoute]);

  const handleQuickActionNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    route: AppRoute,
  ) => {
    closeQuickActions();
    onNavigate(event, route);
  };

  return (
    <div className="mobile-app-shell">
      <a className="skip-link" href="#app-main-content">
        본문 바로가기
      </a>

      <header className="mobile-app-bar">
        <div className="mobile-app-bar__inner">
          <span className="mobile-app-bar__brand" aria-hidden="true">
            <AppIcon name="wallet" size={20} />
          </span>
          <span className="mobile-app-bar__title">
            {APP_ROUTE_TITLES[currentRoute]}
          </span>
        </div>
      </header>

      <main
        className={`mobile-app-content mobile-app-content--${currentRoute.toLowerCase()}`}
        id="app-main-content"
        ref={mainContentRef}
        tabIndex={-1}
      >
        {children}
      </main>

      {currentRoute === 'HOME' || currentRoute === 'TRANSACTIONS' ? (
        <button
          aria-controls="quick-action-sheet"
          aria-expanded={isQuickActionOpen}
          aria-haspopup="dialog"
          aria-label={
            isQuickActionOpen ? '빠른 작업 메뉴 닫기' : '빠른 작업 열기'
          }
          className="mobile-app-fab"
          onClick={() =>
            isQuickActionOpen ? closeQuickActions() : setIsQuickActionOpen(true)
          }
          ref={fabRef}
          type="button"
        >
          <AppIcon name={isQuickActionOpen ? 'close' : 'plus'} size={28} />
        </button>
      ) : null}

      <nav className="bottom-navigation" aria-label="하단 주요 메뉴">
        <div className="bottom-navigation__inner">
          {BOTTOM_NAVIGATION_ITEMS.map((item) => (
            <a
              aria-current={currentRoute === item.route ? 'page' : undefined}
              className="bottom-navigation__item"
              href={getAppRoutePath(item.route)}
              key={item.route}
              onClick={(event) => onNavigate(event, item.route)}
            >
              <AppIcon name={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      </nav>

      {isQuickActionOpen ? (
        <div
          className="quick-action-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) {
              closeQuickActions();
            }
          }}
        >
          <div
            aria-labelledby="quick-action-title"
            aria-modal="true"
            className="quick-action-sheet"
            id="quick-action-sheet"
            ref={sheetRef}
            role="dialog"
          >
            <span className="quick-action-sheet__handle" aria-hidden="true" />
            <div className="quick-action-sheet__heading">
              <div>
                <p>빠른 작업</p>
                <h2 id="quick-action-title">무엇을 할까요?</h2>
              </div>
              <button
                aria-label="빠른 작업 닫기"
                className="quick-action-sheet__close"
                onClick={closeQuickActions}
                type="button"
              >
                <AppIcon name="close" />
              </button>
            </div>
            <div className="quick-action-sheet__actions">
              {QUICK_ACTION_ITEMS.map((item, index) => (
                <a
                  className="quick-action-sheet__action"
                  href={getAppRoutePath(item.route)}
                  key={item.route}
                  onClick={(event) =>
                    handleQuickActionNavigation(event, item.route)
                  }
                  ref={index === 0 ? firstActionRef : undefined}
                >
                  <span className="quick-action-sheet__action-icon">
                    <AppIcon name={item.icon} />
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
