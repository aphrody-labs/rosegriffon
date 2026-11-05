"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { AdSenseScript } from "@rosegriffon/ui";

/**
 * Pages sans publicité : textes légaux et outils, où une annonce n'apporte
 * rien et coûte du temps de rendu. Préfixes de chemin.
 */
const SANS_PUB = ["/legal", "/projets/outils", "/projets/nostalgie", "/design-system", "/admin"];

const GESTES = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/**
 * Charge GTM au premier geste de l'utilisateur plutôt qu'à l'hydratation :
 * le conteneur (~116 Ko) et les polices qu'il tire ne disputent plus le
 * thread principal au premier rendu. Repli : chargement après 8 s d'inactivité,
 * pour que les visites sans interaction restent mesurées.
 */
function useGtmAuPremierGeste(gtmId: string | undefined) {
  useEffect(() => {
    if (!gtmId) return;
    let fait = false;
    const charger = () => {
      if (fait) return;
      fait = true;
      for (const g of GESTES) removeEventListener(g, charger);
      clearTimeout(repli);
      const w = window as typeof window & { dataLayer?: unknown[] };
      w.dataLayer ??= [];
      w.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
      const s = document.createElement("script");
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(gtmId)}`;
      document.head.append(s);
    };
    for (const g of GESTES) addEventListener(g, charger, { once: true, passive: true });
    const repli = setTimeout(charger, 8000);
    return () => {
      for (const g of GESTES) removeEventListener(g, charger);
      clearTimeout(repli);
    };
  }, [gtmId]);
}

export function DeferredThirdParties({ gtmId }: { gtmId?: string }) {
  const chemin = usePathname() ?? "/";
  useGtmAuPremierGeste(gtmId);
  const pub = !SANS_PUB.some(p => chemin === p || chemin.startsWith(`${p}/`));
  return pub ? <AdSenseScript /> : null;
}
