import { ImageResponse } from "next/og";

export const alt = "Passifs - Wiki Azalee";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#AB47BC";

const PLAYSTYLES = [
  { label: "Général", color: "#78909C" },
  { label: "Brèche", color: "#E53935" },
  { label: "Tension", color: "#F9A825" },
  { label: "Contre-attaque", color: "#43A047" },
  { label: "Lien", color: "#42A5F5" },
  { label: "Jeu Violent", color: "#FF5722" },
  { label: "Justice", color: "#AB47BC" },
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
          bottom: -100,
          left: "50%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT}10 0%, transparent 70%)`,
          transform: "translateX(-50%)",
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
          Passifs
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
          700+ talents joueur, personnalises et coordinateur
        </div>

        {/* Playstyle pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {PLAYSTYLES.map((p) => (
            <div
              key={p.label}
              style={{
                display: "flex",
                background: `${p.color}15`,
                borderRadius: 20,
                padding: "6px 16px",
                border: `1px solid ${p.color}30`,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: p.color, display: "flex" }}>
                {p.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side - passive card preview */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: 340,
          gap: 12,
          padding: "40px 60px 40px 0",
        }}
      >
        {[
          { name: "Talent Joueur", desc: "Boost conditionnel de stats", color: "#AB47BC" },
          { name: "Talent Perso.", desc: "Bonus personnalisé", color: "#29B6F6" },
          { name: "Coordinateur", desc: "Bonus d'équipe", color: "#66BB6A" },
        ].map((card) => (
          <div
            key={card.name}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              background: "#3D2E2260",
              borderRadius: 16,
              padding: "14px 18px",
              borderLeft: `3px solid ${card.color}`,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 800, color: card.color, display: "flex" }}>
              {card.name}
            </div>
            <div style={{ fontSize: 12, color: "#8A7A6D", display: "flex" }}>{card.desc}</div>
          </div>
        ))}
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
