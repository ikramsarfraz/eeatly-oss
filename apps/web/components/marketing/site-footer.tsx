import Link from "next/link";
import type { Route } from "next";
import { Wordmark } from "@/components/brand/logo";
import { FOOTER_LINKS } from "@/lib/marketing-nav";

/**
 * The shared marketing footer — wordmark + tagline, the footer link set,
 * and the copyright line. One editorial footer across the landing,
 * pricing, privacy, and help pages.
 */
export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-inner">
          <div>
            <Link href="/" className="brand" aria-label="eeatly home">
              <Wordmark size={26} />
            </Link>
            <p className="foot-tag">
              Where your family&apos;s recipes live. Across phones, across chats, across
              continents.
            </p>
          </div>
          <div className="foot-links">
            {FOOTER_LINKS.map((l) => (
              <Link key={l.label} href={l.href as Route}>
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 eeatly</span>
          <span>Made for families who cook apart</span>
        </div>
      </div>
    </footer>
  );
}
