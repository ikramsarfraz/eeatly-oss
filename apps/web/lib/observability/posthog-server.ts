import "server-only";

import { PostHog } from "posthog-node";
import { logger } from "@/lib/observability/logger";

/**
 * Server-side PostHog capture — for events that must fire from trusted
 * server code rather than the client (e.g. `signed_up` at true account
 * creation in the Better Auth `user.create` hook).
 *
 * Inert without `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (same token the client uses; it's
 * public). Sends straight to the PostHog ingestion host — the `/ingest`
 * reverse proxy is a browser-origin concern and doesn't apply here.
 *
 * `flushAt: 1` + an awaited `flush()` make each capture send immediately,
 * which matters in serverless: the function may freeze right after the
 * request, so we can't rely on a background flush interval.
 */
const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

let client: PostHog | null = null;

function getClient(): PostHog | null {
  if (!POSTHOG_KEY) return null;
  if (!client) {
    client = new PostHog(POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0
    });
  }
  return client;
}

export async function capturePostHogServerEvent(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const c = getClient();
  if (!c) return;
  try {
    c.capture({
      distinctId: args.distinctId,
      event: args.event,
      properties: args.properties
    });
    await c.flush();
  } catch (error) {
    // Analytics must never break the calling flow (e.g. signup).
    logger.warn("posthog_server_capture_failed", {
      event: args.event,
      error: error instanceof Error ? error.message : "unknown"
    });
  }
}
