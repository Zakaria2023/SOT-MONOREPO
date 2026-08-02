import { SITE_NAME, SITE_TAGLINE } from "@/lib/seo";
import { ImageResponse } from "next/og";

// Picked up by the file convention: every page that doesn't set its own
// openGraph.images inherits this card, so a shared link is never a bare URL.
export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OpengraphImage = () =>
  new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #0b0f1a 0%, #1b1440 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wordmark only — there is no logo asset yet, and a stand-in shape
            would ship as the brand on every shared link. */}
        <div
          style={{
            display: "flex",
            fontSize: "34px",
            letterSpacing: "-0.5px",
            marginBottom: "36px",
          }}
        >
          {SITE_NAME}
        </div>

        <div
          style={{
            fontSize: "68px",
            lineHeight: 1.1,
            letterSpacing: "-2px",
            maxWidth: "900px",
          }}
        >
          {SITE_TAGLINE}
        </div>

        <div
          style={{
            marginTop: "40px",
            fontSize: "28px",
            color: "#9198ac",
          }}
        >
          Networking · Infrastructure · Security
        </div>
      </div>
    ),
    size,
  );

export default OpengraphImage;
