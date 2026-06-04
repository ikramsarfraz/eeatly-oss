import * as React from "react";

// Matches Tailwind's `md` breakpoint (820px) from the CookLoop Responsive
// handoff — at this width the sidebar flips between an inline rail/full
// variant (≥820) and a sheet variant (<820), and the bottom tab bar appears.
const MOBILE_BREAKPOINT = 820;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
