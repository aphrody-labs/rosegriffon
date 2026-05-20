import { ImageResponse } from "next/og";

export const alt = "Azalée - Inazuma Eleven Victory Road Wiki";
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #1A120D 0%, #2D1F14 50%, #1A120D 100%)",
        color: "white",
        display: "flex",
        flexDirection: "column",
        fontFamily: "sans-serif",
        height: "100%",
        justifyContent: "center",
        overflow: "hidden",
        position: "relative",
        width: "100%",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          background: "linear-gradient(90deg, #F2A93B, #E53935, #43A047, #F9A825, #F2A93B)",
          display: "flex",
          height: 4,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        }}
      />

      {/* Central content */}
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            color: "#F2A93B",
            display: "flex",
            fontSize: 72,
            fontWeight: 900,
          }}
        >
          Azalee
        </div>
        <div
          style={{
            color: "#A09080",
            display: "flex",
            fontSize: 28,
            fontWeight: 600,
          }}
        >
          Inazuma Eleven: Victory Road
        </div>
        <div
          style={{
            color: "#6D5E50",
            display: "flex",
            fontSize: 18,
            marginTop: 8,
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
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                color: "#F2A93B",
                display: "flex",
                fontSize: 32,
                fontWeight: 900,
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                color: "#6D5E50",
                display: "flex",
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: 2,
                textTransform: "uppercase",
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
          alignItems: "center",
          bottom: 20,
          display: "flex",
          gap: 8,
          position: "absolute",
        }}
      >
        <div style={{ color: "#F2A93B", display: "flex", fontSize: 14, fontWeight: 700 }}>
          azalee.rosegriffon.fr
        </div>
        <div style={{ color: "#6D5E50", display: "flex", fontSize: 12 }}>Rose Griffon</div>
      </div>
    </div>,
    { ...size },
  );
}
