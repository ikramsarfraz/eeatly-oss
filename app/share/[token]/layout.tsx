import Link from "next/link";
import type { Route } from "next";
import { ChefHat } from "lucide-react";

/**
 * Round 7 — minimal public chrome for share pages. Distinct from the
 * marketing `(public)` layout: no sign-in nav (this page's audience is
 * arriving from WhatsApp / iMessage and doesn't have an account yet),
 * single "Get eeatly" CTA in the footer, no other distractions.
 *
 * The page itself owns its OG metadata + JSON-LD schema; this layout
 * stays in the visual chrome lane.
 */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ChefHat className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold">eeatly</span>
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="mt-12 border-t">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>eeatly helps you remember the meals worth making again.</p>
          <div className="flex gap-4">
            <Link href={"/" as Route} className="font-medium text-foreground hover:underline">
              Get eeatly
            </Link>
            <Link href={"/privacy" as Route} className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
