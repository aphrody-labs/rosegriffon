import { ImageResponse } from "next/og";
import { wikiService } from "@/lib/wiki-service";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://azalee.rosegriffon.fr";

function absoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/storage/")) return `${SUPABASE_URL}${url}`;
  return `https://azalee.rosegriffon.fr${url}`;
}

export const alt = "Technique Inazuma Eleven Victory Road - Azalee";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ELEMENT_COLORS: Record<string, string> = {
  Fire: "#E53935",
  Wind: "#43A047",
  Forest: "#1B5E20",
  Mountain: "#F9A825",
  Void: "#78909C",
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const skill = await wikiService.getSkill(id);

  if (!skill) {
    return new ImageResponse(
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1A120D 0%, #2D1F14 100%)",
          color: "#F2A93B",
          fontSize: 48,
          fontWeight: 700,
        }}
      >
        Technique introuvable
      </div>,
      { ...size },
    );
  }

  const name = skill.name_FR || skill.name_EN || skill.displayName || "???";
  const category = skill.categoryName?.fr || skill.categoryName?.en || "Special";
  const element = skill.elementName?.en || "Void";
  const elementFr = skill.elementName?.fr || "";
  const power = skill.power_min
    ? skill.power_max && skill.power_max !== skill.power_min
      ? `${skill.power_min} - ${skill.power_max}`
      : `${skill.power_min}`
    : null;
  const tp = skill.consumeTp || null;

  const elementColor = ELEMENT_COLORS[element] || "#78909C";

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
          background: `linear-gradient(90deg, #F2A93B, ${elementColor}, #F2A93B)`,
          display: "flex",
        }}
      />

      {/* Background glow */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${elementColor}10 0%, transparent 70%)`,
          transform: "translate(-50%, -50%)",
          display: "flex",
        }}
      />

      {/* Skill image */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 300,
          padding: "40px 20px 40px 60px",
          flexShrink: 0,
        }}
      >
        {absoluteUrl(skill.image) ? (
          <img
            src={absoluteUrl(skill.image)!}
            width={180}
            height={180}
            style={{
              borderRadius: 20,
              objectFit: "contain",
              border: `2px solid ${elementColor}60`,
            }}
            alt={`Image de la technique ${name}`}
          />
        ) : (
          <div
            style={{
              width: 180,
              height: 180,
              borderRadius: 20,
              background: "#3D2E22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 64,
              color: elementColor,
              border: `2px solid ${elementColor}60`,
            }}
          >
            ⚡
          </div>
        )}
      </div>

      {/* Info */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "40px 60px 40px 0",
          flex: 1,
          gap: 16,
        }}
      >
        {/* Category label */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#A09080",
            textTransform: "uppercase",
            letterSpacing: 3,
            display: "flex",
          }}
        >
          {category}
        </div>

        {/* Name */}
        <div
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: "white",
            lineHeight: 1.1,
            display: "flex",
          }}
        >
          {name}
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {elementFr && (
            <div
              style={{
                display: "flex",
                background: `${elementColor}20`,
                borderRadius: 20,
                padding: "8px 20px",
                fontSize: 18,
                fontWeight: 700,
                color: elementColor,
                border: `1px solid ${elementColor}40`,
              }}
            >
              {elementFr}
            </div>
          )}
          {power && (
            <div
              style={{
                display: "flex",
                background: "#3D2E22",
                borderRadius: 20,
                padding: "8px 20px",
                fontSize: 18,
                fontWeight: 700,
                color: "#F2A93B",
                border: "1px solid #5D4E42",
              }}
            >
              Puissance {power}
            </div>
          )}
          {tp && (
            <div
              style={{
                display: "flex",
                background: "#3D2E22",
                borderRadius: 20,
                padding: "8px 20px",
                fontSize: 18,
                fontWeight: 700,
                color: "#29B6F6",
                border: "1px solid #5D4E42",
              }}
            >
              {tp} TP
            </div>
          )}
        </div>
      </div>

      {/* Branding */}
      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: 60,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: "#F2A93B",
            display: "flex",
          }}
        >
          azalee.rosegriffon.fr
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#6D5E50",
            display: "flex",
          }}
        >
          Inazuma Eleven: Victory Road
        </div>
      </div>
    </div>,
    { ...size },
  );
}
