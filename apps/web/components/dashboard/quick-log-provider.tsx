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
  // The ⌘E shortcut was removed — open via the sidebar "Log a meal" button.

  return (
    <QuickLogContext.Provider value={{ open }}>
      {children}
      <QuickLogDialog open={isOpen} onOpenChange={setIsOpen} />
    </QuickLogContext.Provider>
  );
}
