import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Default social-share card (1200x630 PNG) for every page that doesn't
 * supply its own. Next injects this as `og:image` + (via twitter-image.tsx)
 * `twitter:image`, replacing the old `/og.svg` that social scrapers refused
 * to render. Brand light theme only: the cream palette reads on both light
 * and dark chat backgrounds.
 *
 * `runtime = nodejs` is required: Satori needs the TTF font bytes from
 * `fs`, and the OFL TTFs are vendored at `assets/og/` (Satori can't use the
 * `_next/static/media/*.woff2` build output).
 */
export const runtime = "nodejs";
export const alt = "eeatly: one kitchen for your whole family";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const dir = join(process.cwd(), "assets/og");
  const [serifItalic, serifRegular, mono] = await Promise.all([
    readFile(join(dir, "InstrumentSerif-Italic.ttf")),
    readFile(join(dir, "InstrumentSerif-Regular.ttf")),
    readFile(join(dir, "JetBrainsMono-Medium.ttf"))
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          background: "#F5EFE2",
          padding: "96px 110px",
          fontFamily: "Instrument Serif"
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "JetBrains Mono",
            fontSize: 24,
            letterSpacing: 6,
            color: "#5F665B",
            marginBottom: 36
          }}
        >
          FOR FAMILIES WHO COOK FROM FAR APART
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            fontSize: 170,
            lineHeight: 1,
            letterSpacing: -7
          }}
        >
          <span style={{ fontStyle: "italic", color: "#2E5739" }}>ee</span>
          <span style={{ color: "#1A1F1A" }}>atly</span>
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#C66B47",
              marginLeft: 8,
              marginBottom: 26,
              display: "flex"
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            fontStyle: "italic",
            fontSize: 44,
            color: "#5F665B",
            marginTop: 30,
            maxWidth: 920
          }}
        >
          Your family&apos;s recipes, kept across phones, chats, and continents.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Instrument Serif", data: serifItalic, style: "italic", weight: 400 },
        { name: "Instrument Serif", data: serifRegular, style: "normal", weight: 400 },
        { name: "JetBrains Mono", data: mono, style: "normal", weight: 500 }
      ]
    }
  );
}
