import { NextResponse } from "next/server";

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.rosegriffon.fr";

  return NextResponse.json({
    name: "Rose Griffon Public API",
    version: "1.0.0",
    endpoints: {
      info: `${baseUrl}/api/rg/info`,
      articles: `${baseUrl}/api/rg/articles`,
      planning: `${baseUrl}/api/rg/planning`,
      emotes: `${baseUrl}/api/rg/emotes`,
    },
    documentation:
      "Cette API est destinée à être utilisée par les sites partenaires de Rose Griffon.",
  });
}
