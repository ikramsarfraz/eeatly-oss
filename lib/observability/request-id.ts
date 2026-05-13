import "server-only";

import { headers } from "next/headers";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Reads the per-request correlation id set by `middleware.ts`.
 * Use it as a `requestId` field on log calls so a user-reported error
 * (with the id echoed in their response headers) can be grep'd across
 * server logs.
 *
 * Returns `null` outside a request scope.
 */
export async function getRequestId(): Promise<string | null> {
  try {
    const h = await headers();
    return h.get(REQUEST_ID_HEADER) ?? null;
  } catch {
    return null;
  }
}
