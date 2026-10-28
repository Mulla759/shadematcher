import Link from "next/link";

export function Logo({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link className="logo" href={href} aria-label="Auriga home">
      <svg className="logo-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <circle cx="20" cy="20" r="18.5" stroke="currentColor" strokeWidth="0.8" />
        <circle cx="20" cy="20" r="14.5" stroke="currentColor" strokeWidth="0.4" opacity="0.45" />
        <path
          d="M20 8.5 28 31.5M20 8.5 12 31.5M15.2 24.4h9.6"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <circle cx="20" cy="20" r="1.1" fill="currentColor" />
      </svg>
      <span>
        <span className="logo-word">AURIGA</span>
        {!compact && <span className="logo-sub">Colour Atelier · 01</span>}
      </span>
    </Link>
  );
}
