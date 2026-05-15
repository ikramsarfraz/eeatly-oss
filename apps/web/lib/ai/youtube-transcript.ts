import "server-only";

import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptNotAvailableLanguageError,
  YoutubeTranscriptEmptyError,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptError,
  type TranscriptResponse
} from "@danielxceron/youtube-transcript";
import {
  YoutubeFetchFailedError,
  YoutubeNoTranscriptError,
  YoutubeUnavailableError
} from "@/lib/errors/youtube";
import { logger } from "@/lib/observability/logger";

/**
 * Round 7 — swappable transcript fetcher. The rest of the system
 * (service + tRPC procedure + UI) talks to this `TranscriptFetcher`
 * interface, not to library types, so replacing the underlying
 * library is a one-file change.
 *
 * Currently backed by `@danielxceron/youtube-transcript`, a
 * maintained fork of the original `youtube-transcript` package
 * (which has been unmaintained for 12+ months and started returning
 * false "Transcript is disabled" errors as YouTube's HTML changed).
 * The fork adds an InnerTube API fallback that kicks in when the
 * HTML scrape returns empty.
 *
 * If this fork also becomes unreliable, the long-term plan is
 * Whisper-on-audio via ytdl-core — same `TranscriptFetcher` interface,
 * different implementation, bypasses YouTube's caption infrastructure
 * entirely.
 */

export type TranscriptSegment = TranscriptResponse;

export interface TranscriptFetcher {
  fetch(videoUrlOrId: string, signal?: AbortSignal): Promise<TranscriptSegment[]>;
}

const TRANSCRIPT_TIMEOUT_MS = 10_000;

/**
 * Default implementation backed by `@danielxceron/youtube-transcript`.
 *
 * Unlike the original `youtube-transcript` package, the fork does not
 * accept a custom `fetch` for the underlying HTTP calls — it uses the
 * global `fetch` directly. So we enforce the 10s timeout via
 * `Promise.race` rather than an AbortSignal. The underlying fetch
 * continues in the background on timeout (it will be GC'd when its
 * own socket times out), but the caller gets a timely error.
 */
export const youtubeTranscriptFetcher: TranscriptFetcher = {
  async fetch(videoUrlOrId: string, signal?: AbortSignal): Promise<TranscriptSegment[]> {
    try {
      return await raceWithTimeout(
        YoutubeTranscript.fetchTranscript(videoUrlOrId),
        TRANSCRIPT_TIMEOUT_MS,
        signal
      );
    } catch (error) {
      logger.warn("youtube_transcript_fetch_failed", {
        videoUrlOrId,
        errorName: error instanceof Error ? error.name : "unknown",
        errorMessage: error instanceof Error ? error.message : String(error)
      });
      throw mapLibraryError(error);
    }
  }
};

function raceWithTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err = new Error("Timed out reading the video.");
      err.name = "AbortError";
      reject(err);
    }, timeoutMs);

    const onAbort = () => {
      clearTimeout(timer);
      const err = new Error("Aborted");
      err.name = "AbortError";
      reject(err);
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }

    work.then(
      (value) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

/**
 * Map `@danielxceron/youtube-transcript`'s typed errors into our typed
 * module. Any new subclass falls through to `YoutubeFetchFailedError`
 * and surfaces in logs so we can extend the map.
 */
function mapLibraryError(error: unknown): Error {
  if (error instanceof YoutubeTranscriptDisabledError) {
    // Captions explicitly disabled by the uploader.
    return new YoutubeNoTranscriptError();
  }
  if (error instanceof YoutubeTranscriptNotAvailableError) {
    // No track found for any language — same UX as disabled.
    return new YoutubeNoTranscriptError();
  }
  if (error instanceof YoutubeTranscriptNotAvailableLanguageError) {
    // Requested language unavailable. We don't pass a `lang`, so this
    // shouldn't fire in practice — but treat as "no transcript" so
    // the UX is consistent if YouTube ever returns an empty default.
    return new YoutubeNoTranscriptError();
  }
  if (error instanceof YoutubeTranscriptEmptyError) {
    // Both HTML scrape and InnerTube returned empty. Functionally the
    // same as "no transcript available."
    return new YoutubeNoTranscriptError();
  }
  if (error instanceof YoutubeTranscriptVideoUnavailableError) {
    // Private, removed, region-blocked, or age-restricted. The
    // library doesn't distinguish age-restriction; bundle them as
    // "unavailable" — the UI copy covers both cases.
    return new YoutubeUnavailableError();
  }
  if (error instanceof YoutubeTranscriptError) {
    // Catch-all for the library's own family (e.g., too-many-requests).
    return new YoutubeFetchFailedError(
      error instanceof Error ? error.message : undefined
    );
  }
  // AbortError from our 10s timeout — wrapped as fetch-failed so the
  // user gets a retry-able message instead of a generic crash.
  if (error instanceof Error && error.name === "AbortError") {
    return new YoutubeFetchFailedError("Timed out reading the video.");
  }
  return new YoutubeFetchFailedError();
}
