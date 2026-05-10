"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type LabelMap = Record<string, string>;

interface BreadcrumbLabelContextValue {
  labels: LabelMap;
  setLabel: (href: string, label: string) => void;
  clearLabel: (href: string) => void;
}

const BreadcrumbLabelContext = createContext<BreadcrumbLabelContextValue>({
  labels: {},
  setLabel: () => {},
  clearLabel: () => {},
});

export function BreadcrumbLabelProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [labels, setLabels] = useState<LabelMap>({});

  const setLabel = useCallback((href: string, label: string) => {
    setLabels(prev => {
      if (prev[href] === label) return prev;
      return { ...prev, [href]: label };
    });
  }, []);

  const clearLabel = useCallback((href: string) => {
    setLabels(prev => {
      if (!(href in prev)) return prev;
      const next = { ...prev };
      delete next[href];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ labels, setLabel, clearLabel }),
    [labels, setLabel, clearLabel],
  );

  return (
    <BreadcrumbLabelContext.Provider value={value}>
      {children}
    </BreadcrumbLabelContext.Provider>
  );
}

export function useBreadcrumbLabels() {
  return useContext(BreadcrumbLabelContext);
}

export function useSetBreadcrumbLabel(
  href: string,
  label: string | null | undefined,
) {
  const { setLabel, clearLabel } = useContext(BreadcrumbLabelContext);

  useEffect(() => {
    if (label) {
      setLabel(href, label);
    }
    return () => {
      clearLabel(href);
    };
  }, [href, label, setLabel, clearLabel]);
}
