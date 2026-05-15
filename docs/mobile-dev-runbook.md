# Mobile dev runbook (Round 12)

How to get the Expo app running on a real phone and verify the full
"sign in with magic link → see Hello, [name]" flow end-to-end.

## One-time setup

### 1. EAS + Expo accounts

You need an Expo account (free) for builds. Sign up at https://expo.dev
and install the CLI globally:

```bash
npm install -g eas-cli
eas login
```

### 2. App config link

Once, from `apps/mobile/`:

```bash
cd apps/mobile
eas init
```

This adds an `id` field to `app.json`'s `expo.extra.eas.projectId`.
Commit that to git.

### 3. Local dev tunnel for the API

The phone can't reach `localhost:3000` on your Mac. Two options:

- **LAN IP (simplest)**: find your Mac's LAN address (`ipconfig getifaddr en0`),
  point the mobile app at it: `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000`.
  Requires phone + Mac on same Wi-Fi. Better Auth needs to trust the
  origin too — Round 12 already accepts any localhost / 127.0.0.1 origin
  in dev, but LAN IPs aren't covered. Add yours to
  `apps/web/lib/auth/index.ts:developmentLocalhostOrigins` temporarily,
  or use option 2.

- **`pnpm dlx ngrok http 3000`** (or Cloudflare Tunnel): exposes
  `localhost:3000` as `https://<random>.ngrok.app`. Set
  `EXPO_PUBLIC_API_BASE_URL` to that URL, plus update
  `NEXT_PUBLIC_APP_URL` + `BETTER_AUTH_URL` in `apps/web/.env.local`
  to the same URL so the magic-link emails point at the tunneled
  origin. Easier than the LAN approach.

### 4. Env vars

`apps/mobile/.env` (gitignored):

```
EXPO_PUBLIC_API_BASE_URL=https://your-tunnel-or-lan-url
```

`apps/web/.env.local` (gitignored): pin all of the standard server env
vars + `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` to whatever the phone
can reach.

## Dev build

The handoff explicitly rules out Expo Go — Better Auth's bearer-token
flow + deep-link verify route need custom native code. You need a
**dev client** built once and installed on the phone; after that,
`expo start` connects to it like Expo Go would.

### iOS

```bash
cd apps/mobile

# First time only — prebuild native iOS project files
pnpm prebuild --platform ios

# Build a dev client. EAS does it in the cloud (free tier OK).
eas build --profile development --platform ios

# Or build locally if you have Xcode set up:
#   pnpm dlx expo run:ios --device
```

The build emits an .ipa. Install on your phone via QR code (EAS prints
one) or `eas device:create` flow.

Requires an Apple Developer account ($99/year) OR your free Apple ID
for ad-hoc installs (limited to 3 apps + 7-day signature lifetime).

### Android

```bash
cd apps/mobile
pnpm prebuild --platform android
eas build --profile development --platform android
# Outputs an APK; sideload onto phone over USB or via the EAS QR code
```

No paid account required for Android.

## Running

After the dev client is installed once:

```bash
# Terminal A — web app + API
pnpm dev

# Terminal B — Metro bundler for the dev client
pnpm --filter @eeatly/mobile start
```

Scan the QR code with the dev client app on the phone.

## The verification

1. Phone launches eeatly → `app/index.tsx` reads SecureStore → finds no
   token → routes to `/(auth)/sign-in`.
2. Type your real email → tap **Send sign-in link**.
3. Switch to your email app on the same phone. The link in the email
   should look like `eeatly://verify?token=…` (NOT a `https://…` URL —
   that's the server-side `pickMagicLinkUrl` in
   `apps/web/lib/auth/index.ts` doing its job).
4. Tap the link. iOS/Android opens eeatly, routes to `/verify`.
5. `verify.tsx` exchanges the magic-link token for a session token via
   `GET /api/auth/magic-link/verify`. Reads `set-auth-token` response
   header (Round 12 bearer plugin emits it). Stores in SecureStore.
   Bounces to `/(authed)`.
6. **You should see "Hello, [your name]" and "Backend says: ok
   (HH:MM:SS)".** This is the round-12 deliverable.
7. Tap **Re-ping** to confirm subsequent tRPC calls round-trip.
8. Tap **Sign out** → SecureStore cleared → back to sign-in.
9. Tap **Send sign-in link** again, but this time DO NOT tap the email
   link. Force-quit the app. Re-open. You should land on sign-in again
   (no token persisted).
10. Complete a full sign-in. Force-quit + re-open. You should land
    directly on the authed home (token persisted in Keychain /
    Keystore).

## Troubleshooting

- **Email link goes to browser instead of opening app**: the deep-link
  detection didn't fire. Confirm the link in the email is
  `eeatly://verify?token=…`. If it's `https://…`, the `callbackURL`
  the mobile app sent was wrong, or `pickMagicLinkUrl` in
  `apps/web/lib/auth/index.ts` didn't see it as a mobile scheme.

- **App opens but `verify.tsx` shows "Sign-in failed (404 / 401)"**:
  Better Auth's verify endpoint rejected the token. Possible causes:
  token expired, already-used, or magic-link plugin's `storeToken:
  "hashed"` mismatch. Send a fresh link.

- **`/(authed)` shows "Backend says: …" error**: bearer token isn't
  reaching the server. Check `EXPO_PUBLIC_API_BASE_URL` is set + the
  origin is in `mobileTrustedOrigins()` + the CORS allowlist in the
  tRPC route.

- **"Hello, friend." instead of your name**: `authClient.getSession()`
  returned null, which means the bearer token was rejected. Check the
  Better Auth server logs (`logger.warn("trpc_session_lookup_failed",
  …)`). Clear SecureStore by signing out → request a fresh link.

- **Dev client crashes on launch**: usually a Metro / native dep
  mismatch. `cd apps/mobile && rm -rf .expo node_modules && pnpm
  install` from the workspace root, then rebuild the dev client.

---

## Universal Links + App Links (Round 15.5 Task 3)

iOS Universal Links and Android App Links let an https URL (e.g.
`https://eeatly.app/invite/<token>`) route directly into the installed
app instead of opening the browser. Configured in three places:

1. **Manifest files served from the web origin** — `.well-known/`
   directory in `apps/web/public/`. Already shipped, ready when you
   fill in placeholders:
   - `apple-app-site-association` (no extension, served as
     `application/json` via `next.config.ts`) — `REPLACE_WITH_APPLE_TEAM_ID`
     placeholder. Apple Team ID lives at
     [App Store Connect → Membership](https://appstoreconnect.apple.com).
   - `assetlinks.json` — `REPLACE_WITH_PRODUCTION_SHA256_FINGERPRINT`
     and `REPLACE_WITH_UPLOAD_KEY_SHA256_FINGERPRINT` placeholders.
     Production fingerprint comes from Google Play Console → App
     integrity → App signing certificate. Upload key fingerprint
     comes from your local keystore (`keytool -list -v -keystore
     ~/.gradle/.android/upload-keystore.jks`); needed for testing
     internal builds.
2. **Mobile manifest** — `apps/mobile/app.json` declares
   `ios.associatedDomains` and `android.intentFilters` so the app
   advertises itself as the handler for `applinks:eeatly.app` /
   `https://eeatly.app/invite/*`. Already shipped.
3. **Domain serving the well-known files** — eeatly.app's hosting
   needs to serve `apple-app-site-association` and `assetlinks.json`
   over HTTPS with no redirects. `next.config.ts` sets
   `Content-Type: application/json` for both paths; Vercel / Netlify
   / etc. should respect it.

### After filling in placeholders

1. **Replace `REPLACE_WITH_APPLE_TEAM_ID`** in
   `apps/web/public/.well-known/apple-app-site-association` with the
   10-character team ID. Format is `<TEAM_ID>.<bundle-id>`, e.g.
   `ABCD123456.app.eeatly.mobile`.
2. **Replace the two SHA-256 placeholders** in
   `apps/web/public/.well-known/assetlinks.json`. You may keep just
   the production fingerprint and remove the upload-key entry once
   the Play Store signs your APKs with the upstream key.
3. **Deploy the web app.** The well-known files must be live on the
   production domain before iOS / Android verify the association.
4. **Build a preview / production mobile binary** (`eas build`).
   Universal Links don't work on Expo Go — they require a real
   binary with the entitlements baked in from `app.json`.
5. **Verify on iOS:**
   - Install the build via TestFlight on a real device.
   - In Notes / Mail, type `https://eeatly.app/invite/test-token`
     (just to render the link).
   - Long-press the link → "Open in eeatly" should appear in the
     menu. Tap → app opens directly.
   - If you see "Open in Safari" instead, the AASA file failed to
     fetch. Check `swcd` logs in Console.app filtered by your app's
     bundle ID, or hit
     `https://app-site-association.cdn-apple.com/a/v1/eeatly.app`
     after deploying to see if Apple cached it.
6. **Verify on Android:**
   - `adb shell pm get-app-links app.eeatly.mobile` should show
     `verified` for `eeatly.app` after the app is installed via
     Play.
   - Tap a `https://eeatly.app/invite/...` link from Gmail / Messages
     — the app should open. If not, the assetlinks.json fingerprints
     don't match the installed APK's signing cert.

### Trade-off vs `eeatly://` deep links

Both routes work in parallel:

- **`eeatly://invite/<token>`** — the custom URL scheme R12 shipped.
  Works without any Universal Links setup, but only inside the app
  (e.g. via `Linking.openURL("eeatly://...")` from a Notification or
  manual paste). Web users tapping a `eeatly://` link in their browser
  get a "no app handles this scheme" error.
- **`https://eeatly.app/invite/<token>`** — Universal Links route.
  Falls back to the web page for users without the app installed; OS
  intercepts and routes to the app when it's installed.

The mobile app handles both. R15.5 Task 4 makes the invite email URL
use `https://eeatly.app/invite/...` so it gets the Universal Link
treatment when the app is installed.
