import Link from "next/link";
import type { Route } from "next";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Not found"
};

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--primary-soft)] text-primary">
        <Compass className="h-6 w-6" />
      </span>
      <div className="grid gap-2">
        <h1 className="font-serif text-[40px] font-normal leading-[1.1] tracking-[-0.01em]">
          That page isn&apos;t on the menu.
        </h1>
        <p className="text-[14px] leading-[1.55] text-muted-foreground">
          We couldn&apos;t find the page you were looking for.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href={"/dashboard" as Route}>Back to Tonight</Link>
        </Button>
        <Button variant="ghost" asChild>
          <Link href={"/history" as Route}>Open history</Link>
        </Button>
      </div>
    </main>
  );
}
