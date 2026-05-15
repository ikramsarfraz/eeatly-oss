import "server-only";

import { TRPCError } from "@trpc/server";
import {
  UrlFetchFailedError,
  UrlInvalidError,
  UrlNoMetadataError,
  UrlPrivateNetworkError,
  UrlTooLargeError
} from "@/lib/errors/url-preview";
import { urlPreviewInputSchema } from "@eeatly/api/validators/ai";
import { getUrlPreview } from "@/services/url-preview";
import { protectedProcedure, rateLimit, router } from "../trpc";

/**
 * Round 16 — URL preview.
 *
 * `urlPreview.fetch` takes a URL and returns the OG-derived preview
 * card payload. No Plus gate — link previews are a basic UX feature.
 * `rateLimit("ai")` because the server-side fetch is expensive-ish
 * (network round-trip + parse) and could be abused as a free SSRF
 * scanner / general HTTP probe.
 */
export const urlPreviewRouter = router({
  fetch: protectedProcedure
    .use(rateLimit("ai"))
    .input(urlPreviewInputSchema)
    .query(async ({ input }) => {
      try {
        return await getUrlPreview(input.url);
      } catch (error) {
        if (error instanceof UrlInvalidError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: { reason: "URL_INVALID" }
          });
        }
        if (error instanceof UrlPrivateNetworkError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: { reason: "URL_PRIVATE_NETWORK" }
          });
        }
        if (error instanceof UrlTooLargeError) {
          throw new TRPCError({
            code: "PAYLOAD_TOO_LARGE",
            message: error.message,
            cause: { reason: "URL_TOO_LARGE" }
          });
        }
        if (error instanceof UrlNoMetadataError) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: error.message,
            cause: { reason: "URL_NO_METADATA" }
          });
        }
        if (error instanceof UrlFetchFailedError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message,
            cause: { reason: "URL_FETCH_FAILED" }
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't load that URL right now.",
          cause: { reason: "URL_FETCH_FAILED" }
        });
      }
    })
});
