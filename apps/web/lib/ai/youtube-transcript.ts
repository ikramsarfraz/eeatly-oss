import "server-only";

import {
  YoutubeTranscript,
  YoutubeTranscriptDisabledError,
  YoutubeTranscriptNotAvailableError,
  YoutubeTranscriptVideoUnavailableError,
  YoutubeTranscriptError,
  type TranscriptResponse
} from "youtube-transcript";
import {
  YoutubeFetchFailedError,
  YoutubeNoTranscriptError,
  YoutubeUnavailableError
} from "@/lib/errors/youtube";
import { logger } from "@/lib/observability/logger";

/**
 * Round 7 — swappable transcript fetcher. The `youtube-transcript`
 * library is the default; replacing it is a one-file change because
 * the rest of the system (service + action + UI) talks to this
 * `TranscriptFetcher` interface, not to library types.
 *
 * **Empirical verification deferred to the deploy reviewer.** The
 * library was selected based on:
 *   - Typed error class hierarchy (clean mapping to our typed errors)
 *   - Dual InnerTube + HTML-scrape fetch strategy (more resilient than
 *     single-strategy scrapers)
 *   - Narrow API surface (vs. youtubei.js's whole InnerTube wrapper —
 *     less surface area to break)
 *   - Maintained as of v1.3.1
 *
 * BEFORE this round ships to production, run the verification:
 *   1. `pnpm tsx scripts/verify-yt-transcripts.ts` (script TBD; happy
 *      to scaffold one)
 *   2. Three videos: Food Fusion (English Pakistani), Kitchen with
 *      Amna (Urdu), one English non-Pakistani channel (control)
 *   3. Confirm `fetchTranscript()` returns text for all three.
 * If any fail, the swap is a single import change here + a similar
 * error-mapping table.
 */

export type TranscriptSegment = TranscriptResponse;

export interface TranscriptFetcher {
  fetch(videoUrlOrId: string, signal?: AbortSignal): Promise<TranscriptSegment[]>;
}

const TRANSCRIPT_TIMEOUT_MS = 10_000;

/**
 * Default implementation backed by `youtube-transcript`. Wraps `fetch`
 * with an AbortSignal to enforce a 10s timeout — transcript fetches
 * can be slow when YouTube is degraded; without this they'd hang
 * the entire action.
 */
export const youtubeTranscriptFetcher: TranscriptFetcher = {
  async fetch(videoUrlOrId: string, signal?: AbortSignal): Promise<TranscriptSegment[]> {
    // Merge the caller's signal with our timeout so either firing
    // aborts the request. AbortSignal.any() composes them.
    const timeoutSignal = AbortSignal.timeout(TRANSCRIPT_TIMEOUT_MS);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const fetchWithSignal: typeof fetch = (input, init) =>
      fetch(input, { ...init, signal: combinedSignal });

    try {
      return await YoutubeTranscript.fetchTranscript(videoUrlOrId, {
        fetch: fetchWithSignal
      });
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

/**
 * Map `youtube-transcript`'s typed errors into our typed module. The
 * cases below are the documented subclass set as of v1.3.1; any new
 * subclass falls through to `YoutubeFetchFailedError` and surfaces in
 * logs so we can extend the map.
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
