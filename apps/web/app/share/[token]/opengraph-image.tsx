import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { getOgShareCard } from "@/lib/share/og-share-read";
import { mealPalette } from "@/components/ui/meal-tile";

/**
 * Per-share social card (1200x630 PNG): the dish's hashed-color tile with
 * its giant italic monogram (mirroring the in-app `MealTile`), the recipe
 * title, and a "shared on eeatly" footer. This is the share-loop payoff:
 * a link pasted into WhatsApp / iMessage renders a branded card instead of
 * a blank box.
 *
 * The route backs the same `/share/[token]` URL the page does, so it serves
 * both recipe and plan shares. Color comes from the exported `mealPalette`
 * helper so a given dish lands on the same tile color here and in the live
 * app. Revoked / private / unknown tokens return `null` from the reader,
 * which we turn into a 404 so no card leaks.
 *
 * The token lookup goes through `lib/share/og-share-read` (a lean,
 * DB-only path) rather than `services/shares`, so rendering needs only
 * `DATABASE_URL` and not the full server-env guard (which requires the AI
 * keys). That keeps an unrelated missing key from taking down share cards.
 *
 * `runtime = nodejs` is required for the `fs` TTF reads (Satori can't use
 * the woff2 build output).
 */
export const runtime = "nodejs";
export const alt = "A recipe shared on eeatly";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Keep long titles from overflowing the card. No multi-line auto-fit. */
function clampTitle(title: string): string {
  const t = title.trim();
  return t.length <= 40 ? t : t.slice(0, 39).trimEnd() + "…";
}

function firstLetter(title: string): string {
  return title.trim().charAt(0).toUpperCase() || "·";
}

export default async function Image(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  // Recipe first, then plan — same precedence as the page. `null` means
  // revoked/unknown → 404 so no card leaks.
  const share = await getOgShareCard(token);
  if (!share) notFound();

  const eyebrow = share.kind === "recipe" ? "A FAMILY RECIPE" : "A FAMILY MENU";
  const palette = mealPalette(share.name);
  const letter = firstLetter(share.name);
  const title = clampTitle(share.name);

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
          background: "#F5EFE2",
          padding: 72,
          alignItems: "center",
          gap: 64,
          fontFamily: "Instrument Serif"
        }}
      >
        <div
          style={{
            width: 360,
            height: 360,
            borderRadius: 28,
            background: palette.bg,
            color: palette.fg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0
          }}
        >
          <span
            style={{ fontStyle: "italic", fontSize: 280, lineHeight: 1, letterSpacing: -12 }}
          >
            {letter}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              display: "flex",
              fontFamily: "JetBrains Mono",
              fontSize: 22,
              letterSpacing: 5,
              color: "#5F665B",
              marginBottom: 20
            }}
          >
            {eyebrow}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 88,
              lineHeight: 1.02,
              letterSpacing: -3,
              color: "#1A1F1A"
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              fontSize: 40,
              letterSpacing: -2,
              marginTop: 36
            }}
          >
            <span
              style={{
                display: "flex",
                fontFamily: "JetBrains Mono",
                fontSize: 22,
                color: "#9C9787",
                marginRight: 14,
                marginBottom: 6
              }}
            >
              shared on
            </span>
            <span style={{ fontStyle: "italic", color: "#2E5739" }}>ee</span>
            <span style={{ color: "#1A1F1A" }}>atly</span>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#C66B47",
                marginLeft: 4,
                marginBottom: 8,
                display: "flex"
              }}
            />
          </div>
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
