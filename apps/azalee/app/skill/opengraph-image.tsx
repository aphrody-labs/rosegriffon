import { ImageResponse } from "next/og";

export const alt = "Techniques - Wiki Azalee";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#E53935";

const CATEGORIES = [
  { label: "Tir", color: "#E53935" },
  { label: "Dribble", color: "#43A047" },
  { label: "Defense", color: "#29B6F6" },
  { label: "Arret", color: "#F9A825" },
];

const ELEMENTS = [
  { label: "Feu", color: "#E53935" },
  { label: "Vent", color: "#43A047" },
  { label: "Foret", color: "#1B5E20" },
  { label: "Montagne", color: "#F9A825" },
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
          background: `linear-gradient(90deg, ${CATEGORIES[0].color}, ${CATEGORIES[1].color}, ${CATEGORIES[2].color}, ${CATEGORIES[3].color})`,
          display: "flex",
        }}
      />

      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          bottom: -150,
          left: -100,
          width: 500,
          height: 500,
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
          Techniques
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
          900+ super techniques avec videos et statistiques
        </div>

        {/* Category pills */}
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          {CATEGORIES.map((c) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                background: `${c.color}18`,
                borderRadius: 20,
                padding: "8px 18px",
                border: `1px solid ${c.color}35`,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: c.color, display: "flex" }}>
                {c.label}
              </div>
            </div>
          ))}
        </div>

        {/* Element pills */}
        <div style={{ display: "flex", gap: 12 }}>
          {ELEMENTS.map((e) => (
            <div
              key={e.label}
              style={{
                display: "flex",
                background: `${e.color}12`,
                borderRadius: 20,
                padding: "6px 16px",
                border: `1px solid ${e.color}25`,
              }}
            >
              <div
                style={{ fontSize: 13, fontWeight: 600, color: `${e.color}CC`, display: "flex" }}
              >
                {e.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side decorative */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          width: 300,
          gap: 20,
          padding: "40px 60px 40px 0",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            background: "#3D2E2280",
            borderRadius: 24,
            padding: "24px 32px",
            border: "1px solid #5D4E4240",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "#A09080",
              textTransform: "uppercase",
              letterSpacing: 2,
              display: "flex",
            }}
          >
            Puissance
          </div>
          <div style={{ fontSize: 48, fontWeight: 900, color: "#F2A93B", display: "flex" }}>
            ???
          </div>
          <div style={{ fontSize: 13, color: "#6D5E50", display: "flex" }}>
            TP &bull; Element &bull; Type
          </div>
        </div>
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
