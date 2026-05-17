import { ImageResponse } from "next/og";

export const alt = "Azalée - Inazuma Eleven Victory Road Wiki";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1A120D 0%, #2D1F14 50%, #1A120D 100%)",
        color: "white",
        fontFamily: "sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: "linear-gradient(90deg, #F2A93B, #E53935, #43A047, #F9A825, #F2A93B)",
          display: "flex",
        }}
      />

      {/* Central content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 900,
            color: "#F2A93B",
            display: "flex",
          }}
        >
          Azalee
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: "#A09080",
            display: "flex",
          }}
        >
          Inazuma Eleven: Victory Road
        </div>
        <div
          style={{
            fontSize: 18,
            color: "#6D5E50",
            marginTop: 8,
            display: "flex",
          }}
        >
          Base de donnees complete en francais
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: 40,
          marginTop: 40,
        }}
      >
        {[
          { label: "Joueurs", value: "5 900+" },
          { label: "Techniques", value: "900+" },
          { label: "Objets", value: "3 000+" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: "#F2A93B",
                display: "flex",
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#6D5E50",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: 2,
                display: "flex",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Branding */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "#F2A93B", display: "flex" }}>
          azalee.rosegriffon.fr
        </div>
        <div style={{ fontSize: 12, color: "#6D5E50", display: "flex" }}>Rose Griffon</div>
      </div>
    </div>,
    { ...size },
  );
}
