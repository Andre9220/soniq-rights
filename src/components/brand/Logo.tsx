import { useId } from "react";

/** Brand mark: the "S" wave framed by equalizer bars, as on the SONIQ RIGHTS logo. */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-wave`} x1="20" y1="6" x2="44" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-sky)" />
          <stop offset="0.45" stopColor="var(--brand-deep)" />
          <stop offset="1" stopColor="var(--brand-sky)" />
        </linearGradient>
        <linearGradient id={`${id}-bar`} x1="0" y1="14" x2="0" y2="50" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--brand-deep)" />
        </linearGradient>
      </defs>
      <rect x="3" y="27" width="5" height="10" rx="2.5" fill={`url(#${id}-bar)`} />
      <rect x="11" y="18" width="5" height="28" rx="2.5" fill={`url(#${id}-bar)`} />
      <rect x="48" y="16" width="5" height="32" rx="2.5" fill={`url(#${id}-bar)`} />
      <rect x="56" y="26" width="5" height="12" rx="2.5" fill={`url(#${id}-bar)`} />
      <path
        d="M42 9C29 7 21 13 22 21c1 7 9 9 15 12 6 3 9 6 8 12-1 7-9 11-21 10"
        fill="none"
        stroke={`url(#${id}-wave)`}
        strokeWidth="9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="SONIQ RIGHTS">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-extrabold tracking-[0.04em] text-foreground">
          SONI
          <span className="relative inline-block">
            Q
            <span aria-hidden className="absolute bottom-[0.06em] right-[-0.1em] h-[0.3em] w-[0.24em] skew-x-[38deg] bg-brand" />
          </span>
        </span>
        <span className="mt-1 text-[8.5px] font-medium tracking-[0.42em] text-muted">RIGHTS</span>
      </span>
    </span>
  );
}
