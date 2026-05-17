import type { Metadata } from "next";
import { TranslatorClient } from "@/components/tools/TranslatorClient";

export const metadata: Metadata = {
  title: "Traducteur de noms FR/EN/JA | Inazuma Eleven Victory Road - Azalée",
  description:
    "Trouvez les noms en français, anglais et japonais de tous les personnages, techniques, objets et équipes d'Inazuma Eleven: Victory Road.",
  alternates: { canonical: "/tools/translator" },
};

export default function TranslatorPage() {
  return <TranslatorClient />;
}
