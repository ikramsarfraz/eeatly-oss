"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

type GoogleAuthButtonProps = {
  mode: "sign-in" | "sign-up";
};

export function GoogleAuthButton({ mode }: GoogleAuthButtonProps) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/dashboard"
      });
    } catch {
      setError("Google sign-in is temporarily unavailable. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={onClick}
        disabled={pending}
        className="w-full"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleGlyph className="h-4 w-4" />
        )}
        {mode === "sign-up" ? "Sign up with Google" : "Continue with Google"}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M21.6 12.227c0-.709-.064-1.39-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.994 3.018v2.51h3.222c1.886-1.737 2.99-4.296 2.99-7.35z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.964-.895 6.618-2.422l-3.222-2.51c-.895.6-2.04.954-3.396.954-2.612 0-4.823-1.764-5.611-4.137H3.064v2.59A9.996 9.996 0 0 0 12 22z"
        fill="#34A853"
      />
      <path
        d="M6.389 13.885A6.005 6.005 0 0 1 6.068 12c0-.654.114-1.291.32-1.885V7.525H3.064A9.996 9.996 0 0 0 2 12c0 1.614.386 3.14 1.064 4.475l3.325-2.59z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.977c1.473 0 2.794.507 3.835 1.5l2.86-2.86C16.96 2.99 14.696 2 12 2A9.996 9.996 0 0 0 3.064 7.525l3.325 2.59C7.177 7.741 9.388 5.977 12 5.977z"
        fill="#EA4335"
      />
    </svg>
  );
}
