"use client";

import { Footer } from "@rosegriffon/app-shell";

import { useLanguage } from "@/components/providers/language-provider";
import { ouvrirReglagesConsentement } from "@/lib/consentement";

/** Pied de page du site, avec l'accès aux réglages de consentement. */
export function PiedDePage() {
  const { t } = useLanguage();
  return <Footer onGererCookies={ouvrirReglagesConsentement} libelleCookies={t("consent.manage")} />;
}
