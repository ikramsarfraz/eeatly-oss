import Link from "next/link";
import type { Route } from "next";
import { ChefHat } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </span>
          <span className="text-xl font-semibold">eeatly</span>
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
