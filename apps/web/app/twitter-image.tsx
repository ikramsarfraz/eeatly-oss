// The Twitter card is identical to the OpenGraph card. Reuse the OG route's
// renderer (the default export) so the image never drifts. The route-segment
// config below must be declared as literals here, not re-exported: Next can't
// statically parse a re-exported `runtime`/`size`/etc.
import OgImage from "./opengraph-image";

export const runtime = "nodejs";
export const alt = "eeatly: one kitchen for your whole family";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default OgImage;
