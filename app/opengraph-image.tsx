import { ImageResponse } from "next/og";

export const alt =
  "CitySignal - Where is New York loud? This is not that map. It is a map of who calls 311.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share card is typographic on purpose. Putting a headline figure here would
 * bake a number into an image that social platforms cache indefinitely, so it
 * would drift away from the page it advertises. The page's own numbers are live;
 * this states the framing, which does not change.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#16181a",
          padding: "72px 80px",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
            <div style={{ width: 12, height: 22, background: "#7d7a74", borderRadius: 3 }} />
            <div style={{ width: 12, height: 34, background: "#7d7a74", borderRadius: 3 }} />
            <div style={{ width: 12, height: 56, background: "#c2410c", borderRadius: 3 }} />
          </div>
          <div
            style={{
              color: "#c2410c",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 4,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            CITYSIGNAL
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#eef1f4", fontSize: 92, lineHeight: 1.02, letterSpacing: -2 }}>
            Where is New York loud?
          </div>
          <div style={{ color: "#b9c0c7", fontSize: 38, lineHeight: 1.3, marginTop: 28 }}>
            This is not that map. It is a map of who calls 311 — and those are different maps.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            color: "#9aa3ad",
            fontSize: 22,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div>NYC 311 residential noise complaints, 2024 and 2025</div>
          <div>Live NYC Open Data</div>
        </div>
      </div>
    ),
    size,
  );
}
