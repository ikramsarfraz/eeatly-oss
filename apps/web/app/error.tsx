"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Root error boundary for non-dashboard routes. The `(dashboard)` segment
 * has its own boundary; this catches errors elsewhere (marketing, auth,
 * public pages).
 */
export default function RootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // Surface to the server-side logger via console — Vercel captures these.
    console.error("root_error_boundary", {
      message: error.message,
      digest: error.digest
    });
  }, [error]);

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center gap-5 px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--accent-soft)] text-[#8c4a25] dark:text-[color:var(--terra-fg)]">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div className="grid gap-2">
        <h1 className="font-serif text-[36px] font-normal leading-[1.1] tracking-[-0.01em]">
          Something didn&apos;t load.
        </h1>
        <p className="text-[14px] leading-[1.55] text-muted-foreground">
          eeatly hit an error rendering this page. Trying again usually works.
          {error.digest ? (
            <>
              {" "}If you keep seeing this, mention reference{" "}
              <code className="font-mono-brand text-[12px]">{error.digest}</code>{" "}
              when reporting.
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} type="button">
          <RotateCcw className="h-4 w-4" />
          Try again
        </Button>
        <Button variant="ghost" asChild>
          <Link href={"/dashboard" as Route}>Back to Tonight</Link>
        </Button>
      </div>
    </main>
  );
}
