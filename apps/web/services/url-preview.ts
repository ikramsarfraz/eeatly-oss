import "server-only";

import ogs from "open-graph-scraper";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { urlPreviews } from "@/db/schema";
import {
  assertHostnamePublic,
  parsePublicUrl,
  SsrfRejectedError
} from "@/lib/url-preview/ssrf";
import {
  UrlFetchFailedError,
  UrlInvalidError,
  UrlNoMetadataError,
  UrlPrivateNetworkError,
  UrlTooLargeError
} from "@/lib/errors/url-preview";
import { logger } from "@/lib/observability/logger";

/**
 * Round 16 — URL preview service.
 *
 * Surface:
 *   - `getUrlPreview(url)` — cache-first; on miss, fetch + parse + persist.
 *
 * Caching policy:
 *   - Successful previews valid for 7 days.
 *   - Failures (any typed error during fetch/parse) cached for 1 hour so a
 *     transient outage doesn't lock us in.
 *
 * SSRF defense (see lib/url-preview/ssrf.ts for details):
 *   1. Scheme must be http or https.
 *   2. Hostname must resolve to only public IPs.
 *
 * Fetch hardening:
 *   - 5s connect+read timeout via AbortSignal.timeout.
 *   - 1 MB body cap. We stream the response and reject early if it grows.
 *   - User-Agent is a plain identifier — no user id, no session — so
 *     server-side fetches don't leak user activity to arbitrary hosts.
 *   - No cookies, no auth headers. Standard fetch defaults don't add
 *     them, but worth restating.
 */

export type UrlPreview = {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  hostName: string;
  fetchedAt: Date;
};

const SUCCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 5_000;
const MAX_BODY_BYTES = 1_000_000;
const USER_AGENT = "eeatly-link-preview/1.0 (+https://eeatly.app)";

export async function getUrlPreview(rawUrl: string): Promise<UrlPreview> {
  // Step 1: parse + validate scheme. Done before any cache touch so
  // we don't end up with rows keyed off bogus inputs.
  let parsed: URL;
  try {
    parsed = parsePublicUrl(rawUrl);
  } catch (error) {
    if (error instanceof SsrfRejectedError) {
      if (error.reason === "invalid_scheme") {
        throw new UrlInvalidError(error.message);
      }
      if (error.reason === "malformed") {
        throw new UrlInvalidError(error.message);
      }
      throw new UrlPrivateNetworkError(error.message);
    }
    throw new UrlInvalidError();
  }

  const canonicalUrl = parsed.toString();

  // Step 2: cache check. Successful previews live 7 days, failures 1 hour.
  const cached = await readCache(canonicalUrl);
  if (cached) {
    if (cached.errorCode) {
      throw errorFromCode(cached.errorCode);
    }
    return cached.preview;
  }

  // Step 3: SSRF check on the hostname.
  try {
    await assertHostnamePublic(parsed.hostname);
  } catch (error) {
    if (error instanceof SsrfRejectedError) {
      const typed =
        error.reason === "private_network"
          ? new UrlPrivateNetworkError(error.message)
          : new UrlInvalidError(error.message);
      await writeFailureCache(canonicalUrl, parsed.hostname, typed.code);
      throw typed;
    }
    throw new UrlInvalidError();
  }

  // Step 4: fetch with timeout + size cap.
  let html: string;
  try {
    html = await fetchHtmlSafely(canonicalUrl);
  } catch (error) {
    const typed =
      error instanceof UrlTooLargeError
        ? error
        : error instanceof UrlFetchFailedError
          ? error
          : new UrlFetchFailedError();
    await writeFailureCache(canonicalUrl, parsed.hostname, typed.code);
    logger.warn("url_preview_fetch_failed", {
      url: canonicalUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    throw typed;
  }

  // Step 5: parse the OG/Twitter metadata. open-graph-scraper takes
  // HTML directly so we keep control of the fetch (and its SSRF
  // hardening) instead of letting the library run its own request.
  let result;
  try {
    result = await ogs({ html, onlyGetOpenGraphInfo: false });
  } catch (error) {
    await writeFailureCache(canonicalUrl, parsed.hostname, "URL_NO_METADATA");
    logger.warn("url_preview_parse_failed", {
      url: canonicalUrl,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new UrlNoMetadataError();
  }

  if (result.error || !result.result) {
    await writeFailureCache(canonicalUrl, parsed.hostname, "URL_NO_METADATA");
    throw new UrlNoMetadataError();
  }

  const og = result.result;
  const title = stripHtml(og.ogTitle ?? og.twitterTitle ?? og.dcTitle ?? null);
  const description = stripHtml(
    og.ogDescription ?? og.twitterDescription ?? og.dcDescription ?? null
  );
  const imageUrl =
    pickFirstImage(og.ogImage) ??
    pickFirstTwitterImage(og.twitterImage) ??
    null;

  if (!title && !description && !imageUrl) {
    await writeFailureCache(canonicalUrl, parsed.hostname, "URL_NO_METADATA");
    throw new UrlNoMetadataError();
  }

  const preview: UrlPreview = {
    url: canonicalUrl,
    title,
    description,
    imageUrl,
    hostName: parsed.hostname,
    fetchedAt: new Date()
  };
  await writeSuccessCache(preview);
  return preview;
}

/**
 * Cache-aware fetcher. Streams the response body chunk-by-chunk so we
 * can abort early if the page exceeds `MAX_BODY_BYTES`. Without this
 * a 100 MB HTML file could OOM the Node worker.
 */
async function fetchHtmlSafely(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        // Identify as a preview bot so well-behaved sites know to send
        // OG-friendly markup rather than e.g. a SPA shell.
        Accept: "text/html,application/xhtml+xml"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch {
    throw new UrlFetchFailedError();
  }

  if (!response.ok) {
    throw new UrlFetchFailedError(`Server responded with ${response.status}.`);
  }

  // Cheap pre-check: if Content-Length is set and over the cap, bail
  // without reading. (Many sites omit it.)
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > MAX_BODY_BYTES) {
    throw new UrlTooLargeError();
  }

  const body = response.body;
  if (!body) {
    throw new UrlFetchFailedError("Empty response body.");
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      received += value.byteLength;
      if (received > MAX_BODY_BYTES) {
        // Cancel the stream so we don't keep reading; the underlying
        // socket closes shortly after.
        await reader.cancel();
        throw new UrlTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

function pickFirstImage(images: { url?: string }[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  const first = images.find((img) => typeof img.url === "string" && img.url);
  return first?.url ?? null;
}

function pickFirstTwitterImage(
  images: { url?: string }[] | undefined
): string | null {
  if (!images || images.length === 0) return null;
  const first = images.find((img) => typeof img.url === "string" && img.url);
  return first?.url ?? null;
}

function stripHtml(value: string | null | undefined): string | null {
  if (!value) return null;
  // og:title / og:description should be plain text per spec, but some
  // sites pack HTML or entities in. Strip tags + decode the few
  // entities that show up in real-world titles. Returning the raw
  // string to the client is dangerous because it lands in a React
  // text node — encoded entities would render literally. React
  // escapes whatever we hand it, so all we need to do here is strip
  // any HTML tags that snuck through.
  const noTags = value.replace(/<[^>]*>/g, "").trim();
  return noTags.length > 0 ? noTags : null;
}

type CachedRow = {
  preview: UrlPreview;
  errorCode: string | null;
} | null;

async function readCache(url: string): Promise<CachedRow> {
  const [row] = await db
    .select()
    .from(urlPreviews)
    .where(eq(urlPreviews.url, url))
    .limit(1);

  if (!row) return null;

  const age = Date.now() - row.fetchedAt.getTime();
  const ttl = row.errorCode ? FAILURE_TTL_MS : SUCCESS_TTL_MS;
  if (age > ttl) return null;

  return {
    preview: {
      url: row.url,
      title: row.title,
      description: row.description,
      imageUrl: row.imageUrl,
      hostName: row.hostName,
      fetchedAt: row.fetchedAt
    },
    errorCode: row.errorCode
  };
}

async function writeSuccessCache(preview: UrlPreview): Promise<void> {
  await db
    .insert(urlPreviews)
    .values({
      url: preview.url,
      title: preview.title,
      description: preview.description,
      imageUrl: preview.imageUrl,
      hostName: preview.hostName,
      fetchedAt: preview.fetchedAt,
      errorCode: null
    })
    .onConflictDoUpdate({
      target: urlPreviews.url,
      set: {
        title: preview.title,
        description: preview.description,
        imageUrl: preview.imageUrl,
        hostName: preview.hostName,
        fetchedAt: preview.fetchedAt,
        errorCode: null
      }
    });
}

async function writeFailureCache(
  url: string,
  hostName: string,
  errorCode: string
): Promise<void> {
  await db
    .insert(urlPreviews)
    .values({
      url,
      title: null,
      description: null,
      imageUrl: null,
      hostName,
      fetchedAt: new Date(),
      errorCode
    })
    .onConflictDoUpdate({
      target: urlPreviews.url,
      set: {
        title: null,
        description: null,
        imageUrl: null,
        hostName,
        fetchedAt: new Date(),
        errorCode
      }
    });
}

function errorFromCode(code: string): Error {
  switch (code) {
    case "URL_INVALID":
      return new UrlInvalidError();
    case "URL_PRIVATE_NETWORK":
      return new UrlPrivateNetworkError();
    case "URL_TOO_LARGE":
      return new UrlTooLargeError();
    case "URL_NO_METADATA":
      return new UrlNoMetadataError();
    default:
      return new UrlFetchFailedError();
  }
}
