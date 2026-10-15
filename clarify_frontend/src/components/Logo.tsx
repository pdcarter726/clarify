import Link from "next/link";

/** Clarify wordmark: the rounded accent tile with a ring, plus the name. Links to `href`. */
export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-2">
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect width="30" height="30" rx="9" fill="var(--accent)" />
        <circle cx="15" cy="15" r="6" fill="none" stroke="var(--on-accent)" strokeWidth="2.75" />
      </svg>
      <span className="disp text-[21px] font-bold">Clarify</span>
    </Link>
  );
}
