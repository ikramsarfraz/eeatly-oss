import Link from "next/link";
import type { Route } from "next";
import { Wordmark } from "@/components/brand/logo";
import "../marketing.css";

/**
 * Public (marketing-adjacent) shell — privacy, help, etc. Uses the same
 * brand chrome + `.mkt` design system as the landing page: cream/forest
 * palette, Geist + Instrument Serif, wordmark topnav, editorial footer.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt min-h-screen">
      <header className="topnav">
        <div className="topnav-inner">
          <Link href="/" className="brand" aria-label="eeatly home">
            <Wordmark size={26} />
          </Link>
          <nav className="topnav-links">
            <Link href={"/pricing" as Route}>Pricing</Link>
            <Link href={"/help" as Route}>Help</Link>
            <Link href={"/sign-in" as Route}>Sign in</Link>
            <Link href={"/sign-up" as Route} className="btn btn-primary">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        {children}
      </main>

      <footer>
        <div className="wrap">
          <div className="foot-inner">
            <div>
              <Link href="/" className="brand" aria-label="eeatly home">
                <Wordmark size={26} />
              </Link>
              <p className="foot-tag">
                Where your family&apos;s recipes live. Across phones, across chats,
                across continents.
              </p>
            </div>
            <div className="foot-links">
              <Link href={"/pricing" as Route}>Pricing</Link>
              <Link href={"/privacy" as Route}>Privacy</Link>
              <Link href={"/help" as Route}>Help</Link>
              <Link href={"/sign-in" as Route}>Sign in</Link>
            </div>
          </div>
          <div className="foot-bottom">
            <span>© 2026 eeatly</span>
            <span>Made for families who cook apart</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
