import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  // Récupérer tous les settings Achilléa en une fois
  const { data: settings } = await supabase
    .from("settings")
    .select("key, value")
    .ilike("key", "home_achillea_%");

  // Valeurs par défaut (copiées depuis src/app/page.tsx)
  const defaults = {
    home_achillea_description:
      "Le carrefour de l'esport Inazuma Eleven ! Gestion de clans, tournois, matchs classés, ranking communautaire et bot officiel.",
    home_achillea_discord:
      "https://discord.gg/achillea-competitif-inazuma-eleven-fr-1055585286320554055",
    home_achillea_image: "https://rosegriffon.fr/achillea/bannière.webp",
    home_achillea_link: "https://achillea.rosegriffon.fr/",
  };

  const getVal = (key: string) =>
    settings?.find((s) => s.key === key)?.value || defaults[key as keyof typeof defaults];

  const info = {
    banner_url: getVal("home_achillea_image"),
    description: getVal("home_achillea_description"),
    discord_url: getVal("home_achillea_discord"),
    website_url: getVal("home_achillea_link"),
  };

  return Response.json(info);
}
