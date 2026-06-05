import { NextResponse, type NextRequest } from "next/server";
import { isAdminHost } from "@/lib/auth/admin-host";

// Header name used for request correlation. If the client (or an upstream
// proxy like Vercel's edge) already supplied one, we prefer that — keeps
// log correlation across hops. Otherwise we mint a fresh one.
const REQUEST_ID_HEADER = "x-request-id";

/**
 * On the admin subdomain, the only product surface is `/admin/*`. We still
 * allow the shared auth flow (so an admin can sign in there) and the API
 * routes (auth + tRPC). Everything else is bounced to the admin home.
 */
function isAdminHostAllowedPath(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/invite")
  );
}

// First admin page (there's no `/admin` index route).
const ADMIN_HOME = "/admin/analytics";

// The only crawlable, indexable pages. Everything else (the authenticated app,
// admin, auth, onboarding, token-gated pages, API) gets an `X-Robots-Tag`
// noindex header — defence in depth alongside robots.txt + per-route metadata,
// and the only signal that survives a redirect (e.g. an app route bouncing an
// anonymous crawler to /sign-in).
const PUBLIC_INDEXABLE_PATHS = new Set(["/", "/pricing", "/privacy", "/help"]);

function isIndexable(pathname: string): boolean {
  if (PUBLIC_INDEXABLE_PATHS.has(pathname)) return true;
  // robots.txt + sitemap.xml + web manifest are served to crawlers as-is.
  return pathname === "/robots.txt" || pathname === "/sitemap.xml";
}

export function proxy(request: NextRequest) {
  const incomingId = request.headers.get(REQUEST_ID_HEADER);
  const requestId = incomingId && incomingId.trim().length > 0
    ? incomingId
    : crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  // Admin-subdomain routing (no-op unless ROOT_DOMAIN is configured and the
  // request lands on `admin.<root>`). The page-level `requirePlatformAdmin`
  // is still the real authz gate — this only shapes which paths the admin
  // host serves.
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (isAdminHost(host)) {
    const { pathname } = request.nextUrl;
    if (pathname === "/" || !isAdminHostAllowedPath(pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = ADMIN_HOME;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next({
    request: { headers: requestHeaders }
  });
  // Echo the id back so the client can include it when filing bug reports.
  response.headers.set(REQUEST_ID_HEADER, requestId);
  // Keep every non-public path out of search indexes.
  if (!isIndexable(request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = {
  // Skip on static assets and Next internals — they don't need correlation.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|og.svg|manifest.webmanifest).*)"
  ]
};
