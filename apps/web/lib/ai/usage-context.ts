import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@/lib/db/client";
import { aiUsageEvents } from "@/db/schema";
import { logger } from "@/lib/observability/logger";

/**
 * Request-scoped AI usage context. The metering wrapper (`withAiCredits`) runs
 * each op inside this context with the user id + credit operation, so the
 * low-level provider calls — which know the model + token counts but not the
 * user — can attribute their usage when they record it.
 */
type AiUsageContext = { userId?: string; operation?: string };

const storage = new AsyncLocalStorage<AiUsageContext>();

export function runWithAiUsageContext<T>(ctx: AiUsageContext, fn: () => Promise<T>): Promise<T> {
  return storage.run(ctx, fn);
}

export function getAiUsageContext(): AiUsageContext | undefined {
  return storage.getStore();
}

/**
 * Record one LLM provider call: emits the same `ai_provider_tokens` log line as
 * before AND persists a queryable `ai_usage_events` row (real token counts +
 * model) for admin COGS. Fire-and-forget — a write failure (e.g. the table
 * not yet migrated) only warns; it never affects the AI call. The user id is
 * pulled from the surrounding usage context.
 */
export function recordAiTokens(input: {
  provider: string;
  model: string;
  operation: string;
  input_tokens: number | null;
  output_tokens: number | null;
}): void {
  logger.info("ai_provider_tokens", {
    provider: input.provider,
    operation: input.operation,
    input_tokens: input.input_tokens,
    output_tokens: input.output_tokens
  });

  const ctx = getAiUsageContext();
  void db
    .insert(aiUsageEvents)
    .values({
      userId: ctx?.userId ?? null,
      operation: ctx?.operation ?? input.operation,
      provider: input.provider,
      model: input.model,
      inputTokens: input.input_tokens ?? 0,
      outputTokens: input.output_tokens ?? 0
    })
    .then(() => undefined)
    .catch((error) => {
      logger.warn("ai_usage_event_record_failed", {
        error: error instanceof Error ? error.message : String(error)
      });
    });
}
