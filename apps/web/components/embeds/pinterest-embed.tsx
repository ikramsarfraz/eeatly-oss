"use client";

import * as React from "react";

/**
 * Pinterest pin embed via the `<a data-pin-do="embedPin">` pattern
 * + their `pinit.js` script. Like the TikTok embed, the script is
 * loaded once per page and rescans on subsequent mounts.
 *
 * Pinterest's embed script executes third-party JS — same caveat as
 * the TikTok embed. We keep this to one embed at a time on the
 * recipe view.
 */
type Props = {
  url: string;
};

const PINTEREST_SCRIPT_SRC = "//assets.pinterest.com/js/pinit.js";

export function PinterestEmbed({ url }: Props) {
  React.useEffect(() => {
    if (document.querySelector(`script[src="${PINTEREST_SCRIPT_SRC}"]`)) {
      // pinit.js exposes `window.PinUtils.build()` to rescan the DOM
      // after the initial load; safe to call multiple times.
      try {
        (window as unknown as { PinUtils?: { build?: () => void } })
          .PinUtils?.build?.();
      } catch {
        // Older versions don't expose this; safe to ignore.
      }
      return;
    }
    const tag = document.createElement("script");
    tag.async = true;
    tag.defer = true;
    tag.src = PINTEREST_SCRIPT_SRC;
    document.body.appendChild(tag);
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] p-3">
      <a
        data-pin-do="embedPin"
        data-pin-width="medium"
        href={url}
        className="text-sm underline-offset-2 hover:underline"
      >
        View pin
      </a>
    </div>
  );
}
