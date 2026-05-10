import Link from "next/link";
import type { Route } from "next";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary font-serif italic text-[26px] leading-none text-primary-foreground">
            C
          </span>
          <span className="text-lg font-semibold">CookLoop</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/sign-in" className="hover:text-foreground">
            Sign in
          </Link>
          <Link href="/sign-up" className="hover:text-foreground">
            Start free
          </Link>
        </nav>
      </header>
      {children}
      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>CookLoop helps you remember meals worth making again.</p>
          <div className="flex gap-4">
            <Link href={"/privacy" as Route} className="hover:text-foreground">
              Privacy
            </Link>
            <Link href={"/help" as Route} className="hover:text-foreground">
              Help
            </Link>
            <Link href="/sign-in" className="hover:text-foreground">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
