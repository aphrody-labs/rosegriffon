import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Mon Équipe — Azalée";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DOTS = [
  { x: 250, y: 120, color: "#dc2626" },
  { x: 950, y: 120, color: "#dc2626" },
  { x: 600, y: 170, color: "#10b981" },
  { x: 350, y: 280, color: "#10b981" },
  { x: 850, y: 280, color: "#10b981" },
  { x: 600, y: 320, color: "#10b981" },
  { x: 250, y: 410, color: "#3b82f6" },
  { x: 450, y: 440, color: "#3b82f6" },
  { x: 750, y: 440, color: "#3b82f6" },
  { x: 950, y: 410, color: "#3b82f6" },
  { x: 600, y: 520, color: "#d97706" },
];

export default function OGImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 40,
          border: "2px solid rgba(255,255,255,0.2)",
          borderRadius: 8,
          display: "flex",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: 315,
          borderTop: "2px solid rgba(255,255,255,0.15)",
          display: "flex",
        }}
      />
      {DOTS.map((dot, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: dot.x - 12,
            top: dot.y - 12,
            width: 24,
            height: 24,
            borderRadius: "50%",
            backgroundColor: dot.color,
            opacity: 0.8,
            boxShadow: `0 0 12px ${dot.color}80`,
            display: "flex",
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 60,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 800,
            color: "white",
            letterSpacing: 2,
            display: "flex",
          }}
        >
          Mon Équipe
        </div>
        <div style={{ fontSize: 22, color: "rgba(255,255,255,0.6)", display: "flex" }}>
          Créez votre équipe Inazuma Eleven idéale
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 50,
          right: 60,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 800, color: "#F2A93B", display: "flex" }}>
          Azalée
        </div>
      </div>
    </div>,
    { ...size },
  );
}
