"use client";

import { Button } from "@rosegriffon/ui";

import { useLanguage } from "@/components/providers/language-provider";
import { ouvrirReglagesConsentement } from "@/lib/consentement";

/** Rappel du consentement et bouton pour changer d'avis, sur la page de confidentialité. */
export function ReglagesCookies() {
  const { t } = useLanguage();
  return (
    <p className="mt-4 flex flex-wrap items-center gap-3">
      <span>{t("consent.policy.intro")}</span>
      <Button variant="outline" className="min-h-11" onClick={ouvrirReglagesConsentement}>
        {t("consent.manage")}
      </Button>
    </p>
  );
}
