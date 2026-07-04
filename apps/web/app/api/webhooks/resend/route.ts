import { Resend } from "resend";

import { getServerEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { withPrivileged } from "@/lib/db/client";
import { ingestVerifiedResendPayload } from "@/services/resend-webhook";

export const runtime = "nodejs";

/**
 * Resend → Svix-signed POST. Configure `RESEND_WEBHOOK_SECRET` and point the Resend
 * dashboard to `https://<host>/api/webhooks/resend`.
 */
export async function POST(request: Request) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch (error) {
    logger.error("resend_webhook_env_invalid", {
      detail: error instanceof Error ? error.message : "unknown"
    });
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const secret = env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const svixId = request.headers.get("svix-id") ?? "";
  const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
  const svixSignature = request.headers.get("svix-signature") ?? "";

  if (!svixId || !svixTimestamp || !svixSignature) {
    logger.warn("resend_webhook_missing_headers", {});
    return Response.json({ error: "Missing signature headers" }, { status: 400 });
  }

  let payloadRaw: string;
  try {
    payloadRaw = await request.text();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  let verified: unknown;
  try {
    verified = new Resend().webhooks.verify({
      payload: payloadRaw,
      webhookSecret: secret,
      headers: {
        id: svixId,
        timestamp: svixTimestamp,
        signature: svixSignature
      }
    });
  } catch (error) {
    logger.warn("resend_webhook_verify_failed", {
      detail: error instanceof Error ? error.message : "unknown"
    });
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    // Webhook acts on behalf of the system across users → privileged.
    await withPrivileged(() => ingestVerifiedResendPayload(verified, svixId));
    return Response.json({ received: true });
  } catch {
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
