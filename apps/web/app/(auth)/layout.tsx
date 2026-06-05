import Link from "next/link";
import type { Route } from "next";
import { Wordmark } from "@/components/brand/logo";
import { noIndexMetadata } from "@/lib/seo/no-index";

// Sign-in / sign-up are utility pages, not search landing pages.
export const metadata = noIndexMetadata;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center">
          <Wordmark size={32} />
        </Link>
        {children}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          eeatly keeps your meal history private to your account.
        </p>
        <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground">
          <Link href={"/privacy" as Route} className="hover:text-foreground">
            Privacy
          </Link>
          <Link href={"/help" as Route} className="hover:text-foreground">
            Help
          </Link>
        </div>
      </div>
    </main>
  );
}
