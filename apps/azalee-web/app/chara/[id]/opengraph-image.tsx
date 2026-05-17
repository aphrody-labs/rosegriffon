import { ImageResponse } from "next/og";
import { wikiService } from "@/lib/wiki-service";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://azalee.rosegriffon.fr";

function absoluteUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/storage/")) return `${SUPABASE_URL}${url}`;
  return `https://azalee.rosegriffon.fr${url}`;
}

export const alt = "Personnage Inazuma Eleven Victory Road - Azalée";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ELEMENT_COLORS: Record<string, string> = {
  Fire: "#E53935",
  Feu: "#E53935",
  Wind: "#43A047",
  Vent: "#43A047",
  Forest: "#1B5E20",
  Foret: "#1B5E20",
  Mountain: "#F9A825",
  Montagne: "#F9A825",
};

const POSITION_LABELS: Record<string, string> = {
  GK: "Gardien",
  DF: "Defenseur",
  MF: "Milieu",
  FW: "Attaquant",
  Coach: "Coach",
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let baseChar = await wikiService.getCharacter(id);
  if (!baseChar) {
    baseChar = await wikiService.getCharacterBySlug(id);
  }

  if (!baseChar) {
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
        Personnage introuvable
      </div>,
      { ...size },
    );
  }

  const variant = baseChar.variants[0];
  const name = baseChar.names.fr || baseChar.names.en || baseChar.names.ja || "Inconnu";
  const nameJa = baseChar.names.ja || "";
  const position = variant?.position || "";
  const element = variant?.element || "";
  const rarity = variant?.rarity || baseChar.bestRarity || "";
  const team = (baseChar as any).teams?.[0]?.names?.fr || "";

  const elementColor = ELEMENT_COLORS[element] || "#F2A93B";
  const positionLabel = POSITION_LABELS[position] || position;

  const stats = variant?.stats?.lv99;

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
      {/* Background accent */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 400,
          height: "100%",
          background: `linear-gradient(180deg, ${elementColor}15 0%, ${elementColor}05 100%)`,
          display: "flex",
        }}
      />

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

      {/* Character image area */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 280,
          padding: "40px 20px 40px 40px",
          flexShrink: 0,
        }}
      >
        {absoluteUrl(baseChar.image) ? (
          <img
            src={absoluteUrl(baseChar.image)!}
            alt={name}
            width={200}
            height={200}
            style={{
              borderRadius: 24,
              objectFit: "cover",
              border: `3px solid ${elementColor}`,
              boxShadow: `0 0 40px ${elementColor}40`,
            }}
          />
        ) : (
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: 24,
              background: "#3D2E22",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 72,
              border: `3px solid ${elementColor}`,
            }}
          >
            ?
          </div>
        )}
      </div>

      {/* Info section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "40px 40px 40px 0",
          flex: 1,
          gap: 12,
        }}
      >
        {/* Name */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: "white",
              lineHeight: 1.1,
              display: "flex",
            }}
          >
            {name}
          </div>
          {nameJa && (
            <div
              style={{
                fontSize: 20,
                color: "#A09080",
                display: "flex",
              }}
            >
              {nameJa}
            </div>
          )}
        </div>

        {/* Badges row */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {positionLabel && (
            <div
              style={{
                display: "flex",
                background: "#3D2E22",
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: 16,
                fontWeight: 700,
                color: "#F2A93B",
                border: "1px solid #5D4E42",
              }}
            >
              {positionLabel}
            </div>
          )}
          {element && (
            <div
              style={{
                display: "flex",
                background: `${elementColor}20`,
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: 16,
                fontWeight: 700,
                color: elementColor,
                border: `1px solid ${elementColor}40`,
              }}
            >
              {element}
            </div>
          )}
          {rarity && (
            <div
              style={{
                display: "flex",
                background: rarity === "BASARA" ? "#7367f020" : "#3D2E22",
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: 16,
                fontWeight: 700,
                color: rarity === "BASARA" ? "#9B8FFF" : "#C0A080",
                border: `1px solid ${rarity === "BASARA" ? "#7367f040" : "#5D4E42"}`,
              }}
            >
              {rarity}
            </div>
          )}
        </div>

        {team && (
          <div
            style={{
              fontSize: 18,
              color: "#A09080",
              display: "flex",
            }}
          >
            {team}
          </div>
        )}

        {/* Stats bar */}
        {stats && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            {[
              { label: "FRA", value: stats.kick, color: "#E53935" },
              { label: "CTR", value: stats.control, color: "#43A047" },
              { label: "TEC", value: stats.technique, color: "#29B6F6" },
              { label: "PRE", value: stats.pressure, color: "#1565C0" },
              { label: "PHY", value: stats.physical, color: "#FF9800" },
              { label: "AGI", value: stats.agility, color: "#FDD835" },
              { label: "INT", value: stats.intelligence, color: "#AB47BC" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: s.color,
                    display: "flex",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 900,
                    color: "white",
                    display: "flex",
                  }}
                >
                  {s.value || "?"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Branding footer */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 40,
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
