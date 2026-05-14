/**
 * Round 7 — typed errors for YouTube transcript extraction. The action
 * layer translates each `.code` into a discriminated-union UI state
 * (see `actions/ai.ts:suggestFromYouTubeAction`); no library-specific
 * error shape leaks into the UI.
 *
 * Library coverage:
 *   - `youtube-transcript@1.3.1` throws typed `YoutubeTranscriptError`
 *     subclasses (Disabled / NotAvailable / VideoUnavailable /
 *     TooManyRequest). The fetcher in `lib/ai/youtube-transcript.ts`
 *     maps each one to a member of this module so the service stays
 *     library-agnostic.
 *   - Future library swap = one fetcher change + maybe a new entry
 *     in the mapping table; service / action / UI untouched.
 */

export class YoutubeShortsUnsupportedError extends Error {
  readonly code = "YOUTUBE_SHORTS_UNSUPPORTED" as const;
  constructor() {
    super("YouTube Shorts don't have transcripts we can read.");
    this.name = "YoutubeShortsUnsupportedError";
  }
}

export class YoutubePlaylistUnsupportedError extends Error {
  readonly code = "YOUTUBE_PLAYLIST_UNSUPPORTED" as const;
  constructor() {
    super("That's a playlist link. Open one video and use its URL.");
    this.name = "YoutubePlaylistUnsupportedError";
  }
}

export class YoutubeNoTranscriptError extends Error {
  readonly code = "YOUTUBE_NO_TRANSCRIPT" as const;
  constructor() {
    super("This video doesn't have captions we can read.");
    this.name = "YoutubeNoTranscriptError";
  }
}

export class YoutubeUnavailableError extends Error {
  readonly code = "YOUTUBE_UNAVAILABLE" as const;
  constructor() {
    super("Video isn't available — it may be private or removed.");
    this.name = "YoutubeUnavailableError";
  }
}

export class YoutubeAgeRestrictedError extends Error {
  readonly code = "YOUTUBE_AGE_RESTRICTED" as const;
  constructor() {
    super("Age-restricted videos can't be read.");
    this.name = "YoutubeAgeRestrictedError";
  }
}

export class YoutubeFetchFailedError extends Error {
  readonly code = "YOUTUBE_FETCH_FAILED" as const;
  constructor(detail?: string) {
    super(detail ?? "Couldn't load the video right now.");
    this.name = "YoutubeFetchFailedError";
  }
}

/**
 * Union for catch-clause narrowing. Each subclass exposes a literal
 * `code` so action layers can switch exhaustively.
 */
export type YoutubeExtractionError =
  | YoutubeShortsUnsupportedError
  | YoutubePlaylistUnsupportedError
  | YoutubeNoTranscriptError
  | YoutubeUnavailableError
  | YoutubeAgeRestrictedError
  | YoutubeFetchFailedError;
