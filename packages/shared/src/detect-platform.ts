/**
 * Round 16 — platform detection for the recipe `source_url`. Decides
 * which embed component (or generic OG preview) to render on the
 * recipe view, and which inline badge to show under the log-form
 * input as the user pastes.
 *
 * Returns a discriminated union — `youtube` / `tiktok` / `pinterest`
 * variants carry the canonical id we need for embedding; `instagram`
 * carries the canonical URL; `web` is the fallback.
 *
 * No SSRF / safety judgments happen here. This is a pure URL parser.
 * The procedure / fetcher handles SSRF when we go to fetch OG data.
 */

export type DetectedPlatform =
  | { platform: "youtube"; videoId: string; canonicalUrl: string }
  | { platform: "tiktok"; canonicalUrl: string; videoId: string | null }
  | { platform: "pinterest"; canonicalUrl: string }
  | { platform: "instagram"; canonicalUrl: string }
  | { platform: "web"; canonicalUrl: string };

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

const TIKTOK_HOSTS = new Set([
  "tiktok.com",
  "www.tiktok.com",
  "vm.tiktok.com",
  "vt.tiktok.com",
  "m.tiktok.com"
]);

const PINTEREST_HOSTS = new Set([
  "pinterest.com",
  "www.pinterest.com",
  "pin.it",
  "pinterest.co.uk",
  "pinterest.ca",
  "pinterest.com.au"
]);

const INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com"
]);

const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{6,}$/;
const TIKTOK_VIDEO_ID = /^\d{6,}$/;

/**
 * Detect the platform of a URL. Returns null for inputs that don't
 * parse as URLs at all — callers can decide whether to show the input
 * as raw text or skip preview entirely.
 */
export function detectPlatform(raw: string): DetectedPlatform | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const host = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const id = extractYouTubeVideoId(parsed);
    if (id) {
      return {
        platform: "youtube",
        videoId: id,
        canonicalUrl: `https://www.youtube.com/watch?v=${id}`
      };
    }
    // Non-watch URLs on a YouTube host (channels, search results) →
    // treat as generic web. The OG preview path still works.
    return { platform: "web", canonicalUrl: parsed.toString() };
  }

  if (TIKTOK_HOSTS.has(host)) {
    const id = extractTikTokVideoId(parsed);
    return {
      platform: "tiktok",
      canonicalUrl: parsed.toString(),
      videoId: id
    };
  }

  if (PINTEREST_HOSTS.has(host)) {
    return { platform: "pinterest", canonicalUrl: parsed.toString() };
  }

  if (INSTAGRAM_HOSTS.has(host)) {
    return { platform: "instagram", canonicalUrl: parsed.toString() };
  }

  return { platform: "web", canonicalUrl: parsed.toString() };
}

function extractYouTubeVideoId(parsed: URL): string | null {
  const host = parsed.hostname.toLowerCase();

  if (host === "youtu.be") {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0];
    return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
  }

  if (parsed.pathname === "/watch" || parsed.pathname === "/watch/") {
    const id = parsed.searchParams.get("v");
    return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
  }

  if (parsed.pathname.startsWith("/embed/")) {
    const id = parsed.pathname.replace(/^\/embed\//, "").split("/")[0];
    return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
  }

  if (parsed.pathname.startsWith("/shorts/")) {
    const id = parsed.pathname.replace(/^\/shorts\//, "").split("/")[0];
    return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
  }

  return null;
}

function extractTikTokVideoId(parsed: URL): string | null {
  // Standard: /@username/video/<numeric-id>
  const match = parsed.pathname.match(/\/video\/(\d+)/);
  if (match && TIKTOK_VIDEO_ID.test(match[1])) {
    return match[1];
  }
  // Short links (vm.tiktok.com, vt.tiktok.com) redirect to the long
  // form; we don't follow redirects client-side. Embed components fall
  // back to the original URL when videoId is null.
  return null;
}
