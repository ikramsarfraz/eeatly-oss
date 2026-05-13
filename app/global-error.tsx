"use client";

import * as React from "react";

/**
 * Catches errors that occur in the root layout itself (before our normal
 * error.tsx can render, since that one relies on the layout). This is the
 * absolute fallback — must render its own <html> and <body>.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("global_error_boundary", {
      message: error.message,
      digest: error.digest
    });
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif", margin: 0, padding: "60px 20px", textAlign: "center", color: "#1b2220", background: "#f7f5ee" }}>
        <main style={{ maxWidth: 480, margin: "0 auto" }}>
          <h1 style={{ fontSize: 28, margin: "0 0 16px" }}>eeatly is down for a moment.</h1>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "#6b746e", margin: "0 0 24px" }}>
            We hit an error we couldn&apos;t recover from on this page.
            {error.digest ? <> Reference: <code>{error.digest}</code>.</> : null}
          </p>
          <button
            onClick={reset}
            type="button"
            style={{
              border: 0,
              padding: "10px 18px",
              borderRadius: 10,
              background: "#2f6f58",
              color: "#f9fffb",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer"
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
