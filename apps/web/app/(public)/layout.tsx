import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import "../marketing.css";

/**
 * Public (marketing-adjacent) shell — privacy, help, pricing. Renders the
 * shared `<SiteHeader>` / `<SiteFooter>` chrome on the `.mkt` design system
 * (cream/forest palette, Geist + Instrument Serif). Each page sets its own
 * content width inside `<main>` — only the chrome is shared. Always presented
 * in light mode (forced by route in `AppThemeProvider`).
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mkt min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
