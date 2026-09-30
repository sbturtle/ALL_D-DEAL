import type { MouseEvent } from 'react';

import { getAppRoutePath, type AppRoute } from '../../app/app-route';
import './not-found-page.css';

type NotFoundPageProps = Readonly<{
  pathname: string;
  onNavigate: (event: MouseEvent<HTMLAnchorElement>, route: AppRoute) => void;
}>;

export function NotFoundPage({ pathname, onNavigate }: NotFoundPageProps) {
  return (
    <section className="not-found-page" aria-labelledby="not-found-title">
      <p className="eyebrow">404</p>
      <h1 id="not-found-title">페이지를 찾을 수 없어요</h1>
      <p>
        입력한 주소 <code>{pathname}</code>에 해당하는 화면이 없어요. 주소에 오타가
        없는지 확인하거나 아래에서 이동해 주세요.
      </p>
      <div className="not-found-page__actions">
        <a
          className="not-found-page__primary"
          href={getAppRoutePath('HOME')}
          onClick={(event) => onNavigate(event, 'HOME')}
        >
          홈으로 가기
        </a>
        <a
          href={getAppRoutePath('TRANSACTIONS')}
          onClick={(event) => onNavigate(event, 'TRANSACTIONS')}
        >
          거래 내역 보기
        </a>
      </div>
    </section>
  );
}
