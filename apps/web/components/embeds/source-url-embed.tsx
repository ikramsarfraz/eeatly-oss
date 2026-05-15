"use client";

import { detectPlatform } from "@eeatly/shared";
import { YouTubeEmbed } from "./youtube-embed";
import { TikTokEmbed } from "./tiktok-embed";
import { PinterestEmbed } from "./pinterest-embed";
import { UrlPreviewCard } from "./url-preview-card";

/**
 * Renders the right embed for a saved meal's `recipeSourceUrl`.
 *
 * - YouTube / TikTok / Pinterest → real embed.
 * - Instagram → OG preview card (no real embed in v1 — see CLAUDE.md
 *   follow-ups).
 * - Web fallback → OG preview card.
 * - Unparseable input → render nothing; the caller decides whether to
 *   show the raw string somewhere.
 */
type Props = {
  url: string;
  mealName?: string;
};

export function SourceUrlEmbed({ url, mealName }: Props) {
  const detected = detectPlatform(url);
  if (!detected) return null;

  switch (detected.platform) {
    case "youtube":
      return <YouTubeEmbed videoId={detected.videoId} title={mealName} />;
    case "tiktok":
      return <TikTokEmbed url={detected.canonicalUrl} />;
    case "pinterest":
      return <PinterestEmbed url={detected.canonicalUrl} />;
    case "instagram":
    case "web":
      return <UrlPreviewCard url={detected.canonicalUrl} />;
  }
}
