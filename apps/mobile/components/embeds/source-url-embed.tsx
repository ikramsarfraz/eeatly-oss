import { detectPlatform } from "@eeatly/shared";
import { YouTubeEmbed } from "./youtube-embed";
import { TikTokEmbed } from "./tiktok-embed";
import { PinterestEmbed } from "./pinterest-embed";
import { UrlPreviewCard } from "./url-preview-card";

/**
 * Picks the right mobile embed for a saved meal's `recipeSourceUrl`.
 * Mirrors the web `SourceUrlEmbed` — same platform map, different
 * embed primitives (WebView instead of iframe).
 */
type Props = {
  url: string;
};

export function SourceUrlEmbed({ url }: Props) {
  const detected = detectPlatform(url);
  if (!detected) return null;

  switch (detected.platform) {
    case "youtube":
      return <YouTubeEmbed videoId={detected.videoId} />;
    case "tiktok":
      return <TikTokEmbed url={detected.canonicalUrl} />;
    case "pinterest":
      return <PinterestEmbed url={detected.canonicalUrl} />;
    case "instagram":
    case "web":
      return <UrlPreviewCard url={detected.canonicalUrl} />;
  }
}
