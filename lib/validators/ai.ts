import { z } from "zod";

/**
 * Round 7 — input validators for the AI-extraction actions. URL
 * classification (Shorts / playlist / watch) lives next to the validator
 * so the gate-action can fail-fast before hitting the service layer.
 *
 * `classifyYoutubeUrl` is the canonical parser. It returns a discriminated
 * union the service uses to decide which typed error to throw — Shorts
 * and playlists are EXPLICITLY rejected with their own codes so the UI
 * can show targeted messaging instead of a generic "no transcript."
 */

export type YoutubeUrlClass =
  | { kind: "watch"; videoId: string; normalizedUrl: string }
  | { kind: "shorts" }
  | { kind: "playlist" }
  | { kind: "invalid" };

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be"
]);

export function classifyYoutubeUrl(raw: string): YoutubeUrlClass {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { kind: "invalid" };
  }

  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return { kind: "invalid" };

  // youtu.be/<id> — short link form
  if (host === "youtu.be") {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0];
    if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
      return {
        kind: "watch",
        videoId: id,
        normalizedUrl: `https://www.youtube.com/watch?v=${id}`
      };
    }
    return { kind: "invalid" };
  }

  // /shorts/<id> — explicit rejection so the UI surfaces a tailored
  // error instead of "no transcript found" (which is what most Shorts
  // would produce since auto-captions are spotty there).
  if (parsed.pathname.startsWith("/shorts/")) {
    return { kind: "shorts" };
  }

  // /playlist?list=... — playlists are explicitly out of scope. /watch
  // URLs with a `list=` query param are still valid watch URLs (the
  // video plays from a playlist context), so we only reject the bare
  // `/playlist` path.
  if (parsed.pathname === "/playlist") {
    return { kind: "playlist" };
  }

  // /watch?v=<id>
  if (parsed.pathname === "/watch" || parsed.pathname === "/watch/") {
    const id = parsed.searchParams.get("v");
    if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
      return {
        kind: "watch",
        videoId: id,
        normalizedUrl: `https://www.youtube.com/watch?v=${id}`
      };
    }
    return { kind: "invalid" };
  }

  // /embed/<id> — uncommon but valid; cover for paste-from-iframe cases.
  if (parsed.pathname.startsWith("/embed/")) {
    const id = parsed.pathname.replace(/^\/embed\//, "").split("/")[0];
    if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) {
      return {
        kind: "watch",
        videoId: id,
        normalizedUrl: `https://www.youtube.com/watch?v=${id}`
      };
    }
  }

  return { kind: "invalid" };
}

export const youtubeUrlSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Paste a YouTube URL.")
    .max(2048, "URL is too long.")
    .refine(
      (v) => {
        const cls = classifyYoutubeUrl(v);
        return cls.kind === "watch" || cls.kind === "shorts" || cls.kind === "playlist";
      },
      { message: "That doesn't look like a YouTube link." }
    )
});

export type YoutubeUrlInput = z.infer<typeof youtubeUrlSchema>;
