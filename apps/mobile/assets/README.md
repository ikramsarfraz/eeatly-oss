# Mobile assets

Round 17 established the design system + splash backgroundColor (`#FBF8F1`),
but did not ship final designer artwork. Drop the following PNGs in here
and wire them into `app.json` when designer assets land:

- `icon.png` (1024×1024) — app icon. Reference via `expo.icon` in `app.json`.
- `adaptive-icon.png` (1024×1024, square within a safe ~432px circle) — Android
  adaptive icon foreground. Reference via `expo.android.adaptiveIcon.foregroundImage`.
- `splash.png` (~1242×2436 or larger) — splash screen artwork on the cream
  background. Reference via the `expo-splash-screen` plugin's `image` field
  in `app.json` plugins.

Until then:

- The splash screen will show a blank cream (`#FBF8F1`) background.
- The app icon falls back to Expo's default.

Asset palette to use when designing:

| Token | Hex |
|---|---|
| Background (splash + icon ground) | `#FBF8F1` |
| Primary (wordmark / glyph) | `#2C5F3F` |
| Accent (occasional highlight) | `#C9A14C` |
