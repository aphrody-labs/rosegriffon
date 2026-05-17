import { ImageResponse } from "next/og";

export const alt = "Objets - Wiki Azalee";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#66BB6A";

const ITEM_TYPES = [
  { label: "Chaussures", emoji: "👟" },
  { label: "Bracelets", emoji: "⌚" },
  { label: "Pendentifs", emoji: "📿" },
  { label: "Liens Kizuna", emoji: "🔗" },
  { label: "Consommables", emoji: "🧪" },
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
          top: -80,
          right: -80,
          width: 450,
          height: 450,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${ACCENT}10 0%, transparent 70%)`,
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
          Objets
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
          3 000+ equipements, consommables et liens Kizuna
        </div>

        {/* Item type pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
          {ITEM_TYPES.map((t) => (
            <div
              key={t.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: `${ACCENT}15`,
                borderRadius: 20,
                padding: "8px 18px",
                border: `1px solid ${ACCENT}30`,
              }}
            >
              <div style={{ fontSize: 16, display: "flex" }}>{t.emoji}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT, display: "flex" }}>
                {t.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side stats */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: 300,
          gap: 12,
          padding: "40px 60px 40px 0",
        }}
      >
        {["Frappe", "Controle", "Technique", "Pression", "Physique", "Agilite", "Intelligence"].map(
          (s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#6D5E50",
                  width: 80,
                  textAlign: "right",
                  display: "flex",
                  justifyContent: "flex-end",
                }}
              >
                {s}
              </div>
              <div
                style={{
                  display: "flex",
                  background: `${ACCENT}30`,
                  borderRadius: 8,
                  padding: "3px 10px",
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: ACCENT, display: "flex" }}>
                  +??
                </div>
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
