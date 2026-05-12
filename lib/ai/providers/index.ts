import "server-only";

import OpenAI from "openai";
import { logger } from "@/lib/observability/logger";

type FallbackCtx = {
  operation: string;
  primaryProvider?: string;
  fallbackProvider?: string;
};

function isAuthError(error: unknown): boolean {
  return error instanceof OpenAI.APIError && (error.status === 401 || error.status === 403);
}

export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  ctx: FallbackCtx
): Promise<T> {
  const primaryProvider = ctx.primaryProvider ?? "openai";
  const fallbackProvider = ctx.fallbackProvider ?? "anthropic";
  const primaryStart = Date.now();

  try {
    const result = await primary();
    logger.info("ai_provider_call", {
      provider: primaryProvider,
      operation: ctx.operation,
      success: true,
      latencyMs: Date.now() - primaryStart
    });
    return result;
  } catch (primaryError) {
    const primaryLatency = Date.now() - primaryStart;

    // Auth errors are config bugs — fail loudly, don't mask with fallback
    if (isAuthError(primaryError)) {
      logger.error("ai_provider_auth_error", {
        provider: primaryProvider,
        operation: ctx.operation,
        latencyMs: primaryLatency,
        error: primaryError instanceof Error ? primaryError.message : String(primaryError)
      });
      throw primaryError;
    }

    logger.warn("ai_provider_call", {
      provider: primaryProvider,
      operation: ctx.operation,
      success: false,
      latencyMs: primaryLatency,
      error: primaryError instanceof Error ? primaryError.message : String(primaryError)
    });

    logger.warn("ai_fallback_triggered", {
      operation: ctx.operation,
      primary_provider: primaryProvider,
      fallback_provider: fallbackProvider,
      primary_error: primaryError instanceof Error ? primaryError.message : String(primaryError)
    });

    const fallbackStart = Date.now();
    try {
      const result = await fallback();
      logger.info("ai_provider_call", {
        provider: fallbackProvider,
        operation: ctx.operation,
        success: true,
        latencyMs: Date.now() - fallbackStart,
        fallback_triggered: true
      });
      return result;
    } catch (fallbackError) {
      logger.error("ai_provider_call", {
        provider: fallbackProvider,
        operation: ctx.operation,
        success: false,
        latencyMs: Date.now() - fallbackStart,
        fallback_triggered: true,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
      });
      throw fallbackError;
    }
  }
}
