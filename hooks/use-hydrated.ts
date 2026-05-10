"use client";

import * as React from "react";

/** True only after mount — avoids SSR/client mismatches from Radix `useId` + `DialogTrigger`. */
export function useHydrated() {
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return hydrated;
}
