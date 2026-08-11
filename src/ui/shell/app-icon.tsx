export type AppIconName =
  | 'close'
  | 'home'
  | 'payroll'
  | 'plus'
  | 'review'
  | 'settings'
  | 'transactions'
  | 'upload';

type AppIconProps = Readonly<{
  name: AppIconName;
  size?: number;
  className?: string;
}>;

function IconPaths({ name }: Readonly<{ name: AppIconName }>) {
  switch (name) {
    case 'home':
      return (
        <>
          <path d="m3.5 10.8 8.5-7 8.5 7" />
          <path d="M5.5 9.4v10h13v-10" />
          <path d="M9.2 19.4v-5.8h5.6v5.8" />
        </>
      );
    case 'transactions':
      return (
        <>
          <path d="M7.5 6h13" />
          <path d="M7.5 12h13" />
          <path d="M7.5 18h13" />
          <path d="M3.5 6h.1" />
          <path d="M3.5 12h.1" />
          <path d="M3.5 18h.1" />
        </>
      );
    case 'payroll':
      return (
        <>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="M3 9h18" />
          <path d="M7 15h4" />
          <path d="M16.5 13.5v3" />
          <path d="M15 15h3" />
        </>
      );
    case 'settings':
      return (
        <>
          <path d="M4 7h10" />
          <path d="M18 7h2" />
          <circle cx="16" cy="7" r="2" />
          <path d="M4 17h2" />
          <path d="M10 17h10" />
          <circle cx="8" cy="17" r="2" />
        </>
      );
    case 'plus':
      return (
        <>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </>
      );
    case 'upload':
      return (
        <>
          <path d="M12 15V3" />
          <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
          <path d="M5 12v7h14v-7" />
        </>
      );
    case 'review':
      return (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.6 2.6L16.5 9" />
        </>
      );
    case 'close':
      return (
        <>
          <path d="m6 6 12 12" />
          <path d="M18 6 6 18" />
        </>
      );
  }
}

export function AppIcon({ name, size = 24, className }: AppIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      >
        <IconPaths name={name} />
      </g>
    </svg>
  );
}
