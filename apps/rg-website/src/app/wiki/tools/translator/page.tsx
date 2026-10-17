import type { Metadata } from "next";
import { TranslatorClient } from "@/components/tools/TranslatorClient";
import { wiki } from "@rosegriffon/app-shell";

export const metadata: Metadata = {
  alternates: { canonical: wiki("/tools/translator") },
  description:
    "Trouvez les noms en français, anglais et japonais de tous les personnages, techniques, objets et équipes d'Inazuma Eleven: Victory Road.",
  title: "Traducteur de noms FR/EN/JA | Inazuma Eleven Victory Road - Azalée",
};

export default function TranslatorPage() {
  return <TranslatorClient />;
}
