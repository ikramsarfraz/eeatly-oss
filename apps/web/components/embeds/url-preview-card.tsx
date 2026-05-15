"use client";

import * as React from "react";
import { ExternalLink, Image as ImageIcon, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { getCause } from "@/lib/trpc/errors";

/**
 * Generic URL preview card. Used for:
 *   - the `web` platform (blog posts, recipe sites, etc.)
 *   - Instagram (real embeds require Meta Developer + App Review;
 *     defer to a future round, surface as OG preview for v1)
 *
 * Renders the OG image lazily — most pages set a 1200×630 share
 * image which is hefty. Plain `<img>` (per the project's
 * `next/image` opt-out) with `loading="lazy"` + `decoding="async"`.
 */
type Props = {
  url: string;
  /**
   * Optional pre-fetched data; if omitted, the component calls
   * `urlPreview.fetch` itself. The log-form preview path uses the
   * embedded fetch; the recipe view fetches server-side and passes
   * the data in.
   */
  initialData?: {
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    hostName: string;
  };
};

export function UrlPreviewCard({ url, initialData }: Props) {
  const enabled = !initialData;
  const query = trpc.urlPreview.fetch.useQuery(
    { url },
    {
      enabled,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: false
    }
  );

  if (initialData) {
    return (
      <PreviewCardContent
        url={url}
        title={initialData.title}
        description={initialData.description}
        imageUrl={initialData.imageUrl}
        hostName={initialData.hostName}
      />
    );
  }

  if (query.isPending) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading preview…
      </div>
    );
  }

  if (query.error) {
    const reason = getCause(query.error)?.reason;
    // No card if the preview path failed — the user still has the
    // raw URL elsewhere. We don't want a noisy red error box for
    // every blog that doesn't set OG tags.
    if (reason === "URL_NO_METADATA") return null;
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[12px] text-muted-foreground">
        Couldn&apos;t load a preview for that URL.
      </div>
    );
  }

  if (!query.data) return null;

  return (
    <PreviewCardContent
      url={url}
      title={query.data.title}
      description={query.data.description}
      imageUrl={query.data.imageUrl}
      hostName={query.data.hostName}
    />
  );
}

function PreviewCardContent({
  url,
  title,
  description,
  imageUrl,
  hostName
}: {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  hostName: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] transition-colors hover:border-[var(--border-strong,#cfccc0)]"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-24 w-24 flex-shrink-0 object-cover sm:h-28 sm:w-28"
        />
      ) : (
        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center bg-[var(--surface-2)] text-muted-foreground sm:h-28 sm:w-28">
          <ImageIcon className="h-6 w-6 opacity-40" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pr-3">
        <span className="flex items-center gap-1 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          {hostName}
          <ExternalLink className="h-3 w-3" />
        </span>
        {title ? (
          <span className="line-clamp-2 text-[14px] font-medium text-foreground">
            {title}
          </span>
        ) : null}
        {description ? (
          <span className="line-clamp-2 text-[12.5px] text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
    </a>
  );
}
