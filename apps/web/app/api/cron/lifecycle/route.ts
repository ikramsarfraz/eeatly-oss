import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { withPrivileged } from "@/lib/db/client";
import { runLifecycleNudges } from "@/services/lifecycle-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daily lifecycle cron. Triggered by Vercel Cron via `vercel.json`. Protects
 * against random callers with `CRON_SECRET`:
 *
 *   - Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically
 *     when the env var is set in the project.
 *   - Local trigger: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/lifecycle`
 */
export async function GET(request: Request) {
  const env = getServerEnv();
  const expected = env.CRON_SECRET?.trim();

  // Without a configured secret, refuse to run — better to fail loudly than
  // expose a public endpoint that touches every user.
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured." },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  try {
    // Cron touches every user → privileged (RLS-bypassing) connection.
    const result = await withPrivileged(() => runLifecycleNudges());
    logger.info("lifecycle_cron_run", {
      ...result,
      durationMs: Date.now() - start
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("lifecycle_cron_failed", {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start
    });
    return NextResponse.json(
      { ok: false, error: "Cron run failed." },
      { status: 500 }
    );
  }
}
