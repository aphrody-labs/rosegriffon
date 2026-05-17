import { ImageResponse } from "next/og";

export const alt = "Joueurs - Wiki Azalee";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#42A5F5";

const POSITIONS = [
  { label: "Attaquant", abbr: "FW", color: "#E53935" },
  { label: "Milieu", abbr: "MF", color: "#43A047" },
  { label: "Defenseur", abbr: "DF", color: "#29B6F6" },
  { label: "Gardien", abbr: "GK", color: "#F9A825" },
];

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
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
          background: `linear-gradient(90deg, #F2A93B, ${ACCENT}, #F2A93B)`,
          display: "flex",
        }}
      />

      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: -100,
          right: -100,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT}12 0%, transparent 70%)`,
          display: "flex",
        }}
      />

      {/* Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "60px 80px",
          flex: 1,
          gap: 20,
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

        <div
          style={{
            fontSize: 64,
            fontWeight: 900,
            color: "white",
            lineHeight: 1.1,
            display: "flex",
          }}
        >
          Joueurs
        </div>

        <div
          style={{
            fontSize: 24,
            color: "#A09080",
            lineHeight: 1.4,
            display: "flex",
            maxWidth: 600,
          }}
        >
          5 900+ personnages avec stats, recrutement et techniques
        </div>

        {/* Position pills */}
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          {POSITIONS.map((p) => (
            <div
              key={p.abbr}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: `${p.color}18`,
                borderRadius: 20,
                padding: "8px 18px",
                border: `1px solid ${p.color}35`,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, color: p.color, display: "flex" }}>
                {p.abbr}
              </div>
              <div
                style={{ fontSize: 14, fontWeight: 600, color: `${p.color}CC`, display: "flex" }}
              >
                {p.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side stats preview */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: 320,
          gap: 16,
          padding: "40px 60px 40px 0",
        }}
      >
        {["Frappe", "Controle", "Technique", "Pression", "Physique", "Agilite", "Intelligence"].map(
          (s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#6D5E50",
                  width: 90,
                  textAlign: "right",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                {s}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 8,
                  borderRadius: 4,
                  background: "#3D2E22",
                  display: "flex",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${55 + i * 6}%`,
                    height: "100%",
                    borderRadius: 4,
                    background: `linear-gradient(90deg, ${ACCENT}80, ${ACCENT})`,
                    display: "flex",
                  }}
                />
              </div>
            </div>
          ),
        )}
      </div>

      {/* Branding */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 80,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
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
