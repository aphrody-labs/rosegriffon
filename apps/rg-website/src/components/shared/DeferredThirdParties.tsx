"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";

import { AdSenseScript } from "@rosegriffon/ui";

import { BandeauConsentement } from "@/components/shared/BandeauConsentement";
import {
  abonnerConsentement,
  type Consentement,
  instantaneConsentement,
  instantaneServeur,
  signauxGoogle,
} from "@/lib/consentement";

/**
 * Pages sans publicité : textes légaux et outils, où une annonce n'apporte
 * rien et coûte du temps de rendu. Préfixes de chemin.
 */
const SANS_PUB = ["/legal", "/projets/outils", "/projets/nostalgie", "/design-system", "/admin"];

const GESTES = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

type FenetreGoogle = typeof window & { dataLayer?: unknown[] };

/** `gtag()` tel que Google le définit : il pousse l'objet `arguments` dans dataLayer. */
const gtag: (...args: unknown[]) => void = function () {
  const w = window as FenetreGoogle;
  w.dataLayer ??= [];
  // oxlint-disable-next-line prefer-rest-params -- le mode consentement exige l'objet arguments, pas un tableau.
  w.dataLayer.push(arguments);
};

/** Consentement courant ; `undefined` tant que le navigateur ne l’a pas lu. */
function useConsentement() {
  return useSyncExternalStore(abonnerConsentement, instantaneConsentement, instantaneServeur);
}

/**
 * GTM ne se charge qu'avec le consentement « mesure d'audience », puis au
 * premier geste (repli : 8 s). Le mode consentement de Google est posé à
 * « refusé » avant le conteneur, puis mis à jour avec le choix réel.
 */
function useGtm(gtmId: string | undefined, c: Consentement | null | undefined) {
  useEffect(() => {
    if (!gtmId || !c?.mesure) return;
    let fait = false;
    const charger = () => {
      if (fait) return;
      fait = true;
      for (const g of GESTES) removeEventListener(g, charger);
      clearTimeout(repli);
      if (document.getElementById("gtm-script")) return;
      gtag("consent", "default", signauxGoogle(null));
      gtag("consent", "update", signauxGoogle(c));
      (window as FenetreGoogle).dataLayer?.push({ "gtm.start": Date.now(), event: "gtm.js" });
      const s = document.createElement("script");
      s.id = "gtm-script";
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
  }, [gtmId, c]);

  // Retrait du consentement après chargement : on prévient GTM.
  useEffect(() => {
    if (c && document.getElementById("gtm-script")) gtag("consent", "update", signauxGoogle(c));
  }, [c]);
}

export function DeferredThirdParties({ gtmId }: { gtmId?: string }) {
  const chemin = usePathname() ?? "/";
  const c = useConsentement();
  useGtm(gtmId, c);
  const pub = c?.pub && !SANS_PUB.some(p => chemin === p || chemin.startsWith(`${p}/`));
  return (
    <>
      <BandeauConsentement consentement={c} />
      {pub ? <AdSenseScript /> : null}
    </>
  );
}
