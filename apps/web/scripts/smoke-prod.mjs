#!/usr/bin/env node
/**
 * Non-invasive HTTP smoke checks (no login, no credentials).
 * Usage: pnpm smoke:prod -- --base-url https://app.example.com
 */
function parseBaseUrl() {
  const argv = process.argv.slice(2);
  let base = process.env.SMOKE_BASE_URL?.trim();
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--base-url" && argv[i + 1]) {
      base = argv[i + 1].trim();
      i += 1;
    }
  }
  if (!base) {
    console.error("Usage: pnpm smoke:prod -- --base-url https://your-origin\n  Or set SMOKE_BASE_URL.");
    process.exit(2);
  }
  return base.replace(/\/$/, "");
}

async function fetchStatus(url, init = {}) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15_000);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "user-agent": "CookLoopSmoke/1.0 (+https://github.com)",
        ...init.headers
      }
    });
  } finally {
    clearTimeout(t);
  }
}

const redirectCodes = new Set([301, 302, 303, 307, 308]);

function okRedirectOrNotFound(status) {
  return redirectCodes.has(status) || status === 404;
}

async function main() {
  const base = parseBaseUrl();
  console.log(`CookLoop smoke (base ${base})\n`);

  const checks = [];

  async function expect200(path, label) {
    const res = await fetchStatus(`${base}${path}`, { redirect: "follow" });
    const ok = res.status === 200;
    checks.push({ label, ok, detail: `GET ${path} -> ${res.status}` });
  }

  async function expectRedirectNoFollow(path, label) {
    const res = await fetchStatus(`${base}${path}`, { redirect: "manual" });
    const ok = redirectCodes.has(res.status);
    checks.push({ label, ok, detail: `GET ${path} -> ${res.status}` });
  }

  async function expectAdminBlocked(path, label) {
    const res = await fetchStatus(`${base}${path}`, { redirect: "manual" });
    const ok = res.status !== 200 && okRedirectOrNotFound(res.status);
    checks.push({
      label,
      ok,
      detail: `GET ${path} -> ${res.status} (expect not 200 unauthenticated)`
    });
  }

  await expect200("/", "Homepage");
  await expect200("/sign-in", "Sign-in page");
  await expect200("/sign-up", "Sign-up page");
  await expectRedirectNoFollow("/dashboard", "Dashboard unauthenticated");
  await expectAdminBlocked("/admin/analytics", "Admin analytics not public");
  await expectAdminBlocked("/admin/users", "Admin users not public");
  await expectAdminBlocked("/admin/emails", "Admin emails not public");

  const whRes = await fetchStatus(`${base}/api/webhooks/resend`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/json"
    },
    body: "{}"
  });
  const webhookUnsignedOk = whRes.status === 400 || whRes.status === 401 || whRes.status === 503;
  checks.push({
    label: "Webhook rejects unsigned POST",
    ok: webhookUnsignedOk,
    detail: `POST /api/webhooks/resend (no Svix headers) -> ${whRes.status} (expect 400/401/503)`
  });

  let allOk = true;
  for (const c of checks) {
    const mark = c.ok ? "OK" : "FAIL";
    console.log(`  [${mark}] ${c.label}`);
    console.log(`       ${c.detail}`);
    if (!c.ok) allOk = false;
  }

  console.log("");
  if (!allOk) {
    console.error("smoke:prod: FAILED");
    process.exit(1);
  }
  console.log("smoke:prod: OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
