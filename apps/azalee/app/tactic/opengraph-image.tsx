import { ImageResponse } from "next/og";

export const alt = "Tactiques - Wiki Azalee";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#26C6DA";

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
          Tactiques
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
          100+ tactiques speciales de match
        </div>

        {/* Info pills */}
        <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
          {[
            { label: "Duree", value: "Variable" },
            { label: "Cooldown", value: "Par match" },
            { label: "Effets", value: "Boost/Debuff" },
          ].map((p) => (
            <div
              key={p.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                background: `${ACCENT}12`,
                borderRadius: 16,
                padding: "12px 20px",
                border: `1px solid ${ACCENT}25`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#6D5E50",
                  textTransform: "uppercase",
                  letterSpacing: 1,
                  display: "flex",
                }}
              >
                {p.label}
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, display: "flex" }}>
                {p.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right side - tactical field preview */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 300,
          padding: "40px 60px 40px 0",
        }}
      >
        <div
          style={{
            width: 200,
            height: 280,
            borderRadius: 20,
            border: `2px solid ${ACCENT}30`,
            background: `${ACCENT}08`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            position: "relative",
          }}
        >
          {/* Field lines */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 10,
              right: 10,
              height: 1,
              background: `${ACCENT}25`,
              display: "flex",
            }}
          />
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              border: `1px solid ${ACCENT}25`,
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
            }}
          />
          {/* Player dots */}
          {[
            { top: "15%", left: "50%" },
            { top: "35%", left: "25%" },
            { top: "35%", left: "75%" },
            { top: "55%", left: "30%" },
            { top: "55%", left: "70%" },
            { top: "75%", left: "50%" },
          ].map((pos, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: ACCENT,
                transform: "translate(-50%, -50%)",
                display: "flex",
                boxShadow: `0 0 8px ${ACCENT}60`,
              }}
            />
          ))}
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
