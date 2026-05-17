import { ImageResponse } from "next/og";

export const alt = "Hyper Techniques - Wiki Azalee";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#F9A825";

const AURA_TYPES = [
  { label: "Esprits Guerriers", color: "#F9A825" },
  { label: "Totems", color: "#AB47BC" },
  { label: "Miximax", color: "#26C6DA" },
  { label: "Eveil", color: "#E53935" },
  { label: "Mode Change", color: "#66BB6A" },
];

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
          background: `linear-gradient(90deg, ${AURA_TYPES[0].color}, ${AURA_TYPES[1].color}, ${AURA_TYPES[2].color}, ${AURA_TYPES[3].color}, ${AURA_TYPES[4].color})`,
          display: "flex",
        }}
      />

      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT}08 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          display: "flex",
        }}
      />

      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: ACCENT,
            textTransform: "uppercase",
            letterSpacing: 4,
            display: "flex",
          }}
        >
          Wiki Azalee
        </div>
        <div style={{ fontSize: 64, fontWeight: 900, color: "white", display: "flex" }}>
          Hyper Techniques
        </div>
        <div style={{ fontSize: 22, color: "#A09080", display: "flex" }}>
          Esprits Guerriers, Totems, Miximax et plus
        </div>
      </div>

      {/* Aura type cards */}
      <div style={{ display: "flex", gap: 16, marginTop: 24 }}>
        {AURA_TYPES.map((a) => (
          <div
            key={a.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              background: `${a.color}12`,
              borderRadius: 20,
              padding: "16px 20px",
              border: `1px solid ${a.color}30`,
              minWidth: 140,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: `${a.color}25`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: a.color,
                  display: "flex",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: a.color,
                textAlign: "center",
                display: "flex",
              }}
            >
              {a.label}
            </div>
          </div>
        ))}
      </div>

      {/* Branding */}
      <div
        style={{ position: "absolute", bottom: 20, display: "flex", alignItems: "center", gap: 10 }}
      >
        <img
          src="https://azalee.rosegriffon.fr/logo-og.png"
          width={28}
          height={28}
          style={{ borderRadius: 7 }}
          alt="Logo Azalée"
        />
        <div style={{ fontSize: 14, fontWeight: 700, color: "#F2A93B", display: "flex" }}>
          azalee.rosegriffon.fr
        </div>
        <div style={{ fontSize: 12, color: "#6D5E50", display: "flex" }}>
          Inazuma Eleven: Victory Road
        </div>
      </div>
    </div>,
    { ...size },
  );
}
