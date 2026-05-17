"use client";

import * as React from "react";
import {
  ToastProvider,
  useToast as useUnderlyingToast
} from "@/components/providers/toast-provider";

/**
 * Round 22 — thin convenience wrapper over the existing
 * `components/providers/toast-provider` so new Refine surfaces (and
 * future callers) can write `toast.success("…")` without having to
 * juggle the underlying `showToast({ variant, … })` shape.
 *
 * The wrapper exists rather than replacing the existing provider
 * because the provider is already mounted at `app/layout.tsx` and
 * consumed by ~6 unrelated call sites. Replacing the underlying
 * primitive solely for an API shape change isn't in this round's
 * scope.
 */

type Payload = {
  title: string;
  description?: string;
};

type ToastShortcuts = {
  success: (msg: Payload) => void;
  info: (msg: Payload) => void;
  error: (msg: Payload) => void;
};

export function useToastShortcuts(): ToastShortcuts {
  const { showToast } = useUnderlyingToast();
  return React.useMemo(
    () => ({
      success: (msg) => showToast({ ...msg, variant: "success" }),
      info: (msg) => showToast({ ...msg, variant: "info" }),
      error: (msg) => showToast({ ...msg, variant: "error" })
    }),
    [showToast]
  );
}

export { ToastProvider };
export { useUnderlyingToast as useToast };
