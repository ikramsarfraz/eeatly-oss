# Mobile distribution runbook (Round 15)

How to get TestFlight + Play Store internal builds out so the wife and
beta testers can install the app on their real phones. Reads on top of
the R12 dev runbook ([docs/mobile-dev-runbook.md](mobile-dev-runbook.md)) —
that one covers signing in to the dev client. This one is about producing
distributable binaries.

> **Status:** R15 ships the EAS profile config + scripts. **You** run
> the build/submit commands with real Apple/Google accounts. Pre-flight
> placeholders in `eas.json` need filling in before the first submit —
> they're marked `REPLACE_WITH_*`.

## Prerequisites

- [x] Apple Developer Program account — **$99/year**. Sign up at
  [developer.apple.com](https://developer.apple.com/programs/). Required
  for TestFlight and the App Store. The first build takes ~24h to clear
  Apple's processing; budget accordingly.
- [x] Google Play Console account — **$25 one-time**. Sign up at
  [play.google.com/console](https://play.google.com/console/). Lower
  friction than Apple, but you still need to fill out the data-safety
  form and app-content questionnaire before promoting an internal-track
  build to anyone outside your team.
- [x] Expo account + EAS CLI — covered in the R12 dev runbook. Verify
  with `eas whoami`.
- [x] App-store assets — placeholder icon/splash today. Real assets
  needed before public release; see [Assets](#assets) below.

## EAS build profiles

`apps/mobile/eas.json` ships three profiles:

| Profile | Distribution | API URL | Purpose |
|---|---|---|---|
| `development` | internal | localhost:3000 | Dev client — same as R12 runbook |
| `preview` | internal | https://eeatly.app | Wife + beta testers via TestFlight / Play internal |
| `production` | store | https://eeatly.app | App Store + Play production |

Set the API URL per-profile via the `env.EXPO_PUBLIC_API_BASE_URL` field
inside `eas.json` (already wired). Locally you copy
[`apps/mobile/.env.example`](../apps/mobile/.env.example) to `.env` and
edit.

## iOS (TestFlight)

### One-time

1. **Apple Team ID.** From [App Store Connect](https://appstoreconnect.apple.com)
   → Account → Membership. Replace `REPLACE_WITH_APPLE_TEAM_ID` in
   [`apps/mobile/eas.json`](../apps/mobile/eas.json) (submit section, ios).
2. **App Store Connect record.** Create the app once via the ASC web UI
   with bundle ID `app.eeatly.mobile`. Save the App Store Connect "App
   ID" (different from bundle ID — it's a numeric ID) and put it in
   `ascAppId` in `eas.json`.
3. **App-specific password.** ASC requires a one-time password for the
   `eas submit` upload. From [appleid.apple.com](https://appleid.apple.com) →
   Sign-In and Security → App-Specific Passwords. EAS will prompt for
   this on first submit and store it via macOS keychain.
4. **Apple ID for builds.** `appleId` field in `eas.json` should be the
   account email tied to your Apple Developer team. Replace
   `EEATLY_APPLE_ID@EXAMPLE.COM`.

### Each build

```bash
cd apps/mobile

# Preview build (TestFlight / internal). Choose a fresh credential
# the first time; EAS creates a distribution cert + provisioning
# profile and keeps them in your account for next time.
eas build --profile preview --platform ios

# When the build completes, submit it to TestFlight.
eas submit --profile preview --platform ios --latest
```

The submit step uploads to ASC's transport service. iTunes-style
processing takes 5–30 minutes, then the build is testable.

### Inviting the wife (or other testers)

In ASC → TestFlight → Internal Testing or External Testing, add testers
by Apple ID email. They get an email; on their iPhone they install
TestFlight from the App Store, follow the link, and the eeatly build
appears in TestFlight. External testers (more than 25) need a Beta
App Review first; internal (your team) does not.

### Common pitfalls

- **"Missing provisioning profile."** Run `eas credentials` and let EAS
  regenerate. Don't try to manage cert + profile by hand unless you
  know what you're doing.
- **"Invalid binary"** during transport. Almost always a missing
  `Info.plist` permission string. R13/R14/R15 add the camera, photo
  library, and microphone descriptions; check [`apps/mobile/app.json`](../apps/mobile/app.json)
  if you add a new permission-requiring feature.
- **Build fails on Reanimated / metro-runtime.** R13 hotfix
  ([19df5c6](https://github.com/ikramsarfraz/eeatly/commit/19df5c6))
  added `useWatchman: false` to `metro.config.js`. Don't remove it.

## Android (Play Store internal track)

### One-time

1. **Play Console app record.** Create the app in Play Console with
   package name `app.eeatly.mobile`.
2. **Google Cloud service account.** Play Console → API access → Create
   service account → assign Owner role on the app. Download the JSON
   key. **Don't commit it.** Save it at
   `apps/mobile/google-play-service-account.json` (gitignored as of
   R15) and reference it from `eas.json` (already wired).
3. **Internal testing track.** Play Console → Testing → Internal
   testing → create the tester email list.

### Each build

```bash
cd apps/mobile

# Preview build for internal testers.
eas build --profile preview --platform android

# Push to the internal track. EAS uses the service-account JSON.
eas submit --profile preview --platform android --latest
```

The first internal-track release also requires you to fill out the
content rating questionnaire + data safety form on Play Console.

### Inviting testers

Play Console → Testing → Internal testing → Testers → invite by email
or share the opt-in URL. Once they click the URL and click "Become a
tester," the app appears in their Play Store as installable.

## First-build checklist

Before running `eas build --profile preview` for the first time:

- [ ] `apps/mobile/app.json` `version` reflects what you want users to
      see (semver). R15 ships `0.1.0`.
- [ ] `apps/mobile/eas.json` placeholders filled in
      (`REPLACE_WITH_APPLE_TEAM_ID`, `REPLACE_WITH_ASC_APP_ID`,
      `EEATLY_APPLE_ID@EXAMPLE.COM`).
- [ ] `EXPO_PUBLIC_API_BASE_URL` in `eas.json` points at the right
      backend (`https://eeatly.app` for preview/production).
- [ ] Google Play service-account JSON at
      `apps/mobile/google-play-service-account.json` (Android only).
- [ ] `apps/mobile/assets/` populated with real icon + splash assets
      (currently missing — see [Assets](#assets) below).
- [ ] Bundle identifiers / package names match what you registered
      with the stores: `app.eeatly.mobile`.

## Assets

R12 left placeholder icon refs in `app.json`. R13 dropped them when
they were causing prebuild failures. **R15 still has no real assets.**
Before the App Store + Play Store reviews accept a build, you need:

| Asset | Path | Notes |
|---|---|---|
| App icon (iOS) | `apps/mobile/assets/icon.png` | 1024×1024 PNG, no transparency |
| App icon (Android adaptive foreground) | `apps/mobile/assets/adaptive-icon.png` | 1024×1024 PNG, transparent background |
| Splash screen | `apps/mobile/assets/splash.png` | 1284×2778 (modern iPhones), centered |
| Notification icon (Android) | `apps/mobile/assets/notification-icon.png` | 96×96 monochrome |

You can ship a TestFlight build without final assets — Apple is
lenient on the icon for TestFlight (it'll just look like the Expo
default). Play Store internal track is similar. **Production submission
requires real branded assets.**

After dropping the files in, re-add the entries to
[`apps/mobile/app.json`](../apps/mobile/app.json):

```json
"expo": {
  "icon": "./assets/icon.png",
  "splash": {
    "image": "./assets/splash.png",
    "resizeMode": "contain",
    "backgroundColor": "#f7f5ef"
  },
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/adaptive-icon.png",
      "backgroundColor": "#f7f5ef"
    }
  }
}
```

## Smoke test before promoting a build

1. Install the build on a real phone (TestFlight or Play Internal).
2. Sign in with magic link — verifies API URL + bearer auth roundtrip.
3. Snap a photo via AI Capture → save the meal. Verifies camera +
   uploads + R2.
4. Open recipe view → Share → create a link. Verifies sharing + clipboard.
5. (If invite flow is in scope) Send an invitation, accept on a second
   account. Verifies the invite deep-link.

If any of these fail, **do not** promote the build past internal. Roll
back via `eas build:list` + `eas update`/republish a prior known-good
build.

## Versioning

`autoIncrement` is on for the production profile in `eas.json`. EAS
manages the iOS build number + Android version code centrally so you
don't have to remember to bump it. The user-facing `version` string
in `app.json` is your responsibility — bump it before each "marketing
release" (e.g. 0.1.0 → 0.2.0).

## Cost summary

| Item | Cost | Frequency |
|---|---|---|
| Apple Developer Program | $99 USD | Annually |
| Google Play Console | $25 USD | One-time |
| EAS Build | Free tier covers small teams | Per build, free up to limits |
| EAS Submit | Free | Per submit |

The Apple fee renews annually; lapsed accounts have their TestFlight
builds disabled. Calendar this.
