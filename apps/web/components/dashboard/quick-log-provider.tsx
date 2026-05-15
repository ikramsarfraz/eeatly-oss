"use client";

import * as React from "react";
import { QuickLogDialog } from "@/components/dashboard/quick-log-dialog";

type QuickLogContextValue = {
  open: () => void;
};

const QuickLogContext = React.createContext<QuickLogContextValue | null>(null);

export function useQuickLog(): QuickLogContextValue {
  const ctx = React.useContext(QuickLogContext);
  if (!ctx) {
    throw new Error("useQuickLog must be used inside a QuickLogProvider");
  }
  return ctx;
}

export function QuickLogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const open = React.useCallback(() => setIsOpen(true), []);

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "e" && event.key !== "E") return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || event.altKey) return;
      event.preventDefault();
      setIsOpen((prev) => !prev);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <QuickLogContext.Provider value={{ open }}>
      {children}
      <QuickLogDialog open={isOpen} onOpenChange={setIsOpen} />
    </QuickLogContext.Provider>
  );
}
