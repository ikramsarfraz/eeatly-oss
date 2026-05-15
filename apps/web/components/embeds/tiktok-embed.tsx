"use client";

import * as React from "react";

/**
 * TikTok embed via the official `<blockquote class="tiktok-embed">`
 * pattern + their `embed.js` script. We use the simple URL-based
 * embed shape (no videoId required) so short links and full URLs
 * both work — TikTok's script resolves either.
 *
 * Loads the embed script once per page on first mount; the script is
 * idempotent if the user navigates between meals with TikTok sources
 * (it tracks already-rendered blockquotes via a data attribute).
 *
 * Note: TikTok's script executes third-party JS. The recipe view
 * renders one embed at a time and the input is a URL the user
 * themselves pasted — but if you ever render this in a list, audit
 * the CSP first.
 */
type Props = {
  url: string;
};

const TIKTOK_SCRIPT_SRC = "https://www.tiktok.com/embed.js";

export function TikTokEmbed({ url }: Props) {
  React.useEffect(() => {
    // Bail if the script tag is already on the page — TikTok's embed
    // script lazily rescans the DOM on visibility changes, so a fresh
    // tag isn't needed for re-renders.
    if (document.querySelector(`script[src="${TIKTOK_SCRIPT_SRC}"]`)) {
      // Force a rescan by dispatching a load event — required when
      // the script was previously loaded and we just added a new
      // blockquote (e.g. after navigating between recipe pages with
      // client-side routing).
      if (typeof window.dispatchEvent === "function") {
        try {
          (window as unknown as { tiktokEmbed?: { reloadEmbeds?: () => void } })
            .tiktokEmbed?.reloadEmbeds?.();
        } catch {
          // Not all versions of the script expose this; safe to ignore.
        }
      }
      return;
    }
    const tag = document.createElement("script");
    tag.async = true;
    tag.src = TIKTOK_SCRIPT_SRC;
    document.body.appendChild(tag);
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <blockquote
        className="tiktok-embed"
        cite={url}
        data-video-id=""
        style={{ maxWidth: "605px", minWidth: "325px", margin: 0 }}
      >
        <section>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline-offset-2 hover:underline"
          >
            View on TikTok
          </a>
        </section>
      </blockquote>
    </div>
  );
}
