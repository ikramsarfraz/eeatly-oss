import { NextResponse, type NextRequest } from "next/server";

// Header name used for request correlation. If the client (or an upstream
// proxy like Vercel's edge) already supplied one, we prefer that — keeps
// log correlation across hops. Otherwise we mint a fresh one.
const REQUEST_ID_HEADER = "x-request-id";

export function middleware(request: NextRequest) {
  const incomingId = request.headers.get(REQUEST_ID_HEADER);
  const requestId = incomingId && incomingId.trim().length > 0
    ? incomingId
    : crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders }
  });
  // Echo the id back so the client can include it when filing bug reports.
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export const config = {
  // Skip on static assets and Next internals — they don't need correlation.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg|og.svg|manifest.webmanifest).*)"
  ]
};
