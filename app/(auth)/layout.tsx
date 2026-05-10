import Link from "next/link";
import { ChefHat } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ChefHat className="h-5 w-5" />
          </span>
          <span className="text-xl font-semibold">CookLoop</span>
        </Link>
        {children}
        <p className="mt-5 text-center text-xs text-muted-foreground">
          CookLoop keeps your meal history private to your account.
        </p>
      </div>
    </main>
  );
}
