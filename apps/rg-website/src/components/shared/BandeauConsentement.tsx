"use client";

import Link from "@/components/shared/Link";
import { useCallback, useEffect, useId, useState } from "react";

import { Button } from "@rosegriffon/ui";

import { useLanguage } from "@/components/providers/language-provider";
import {
  type Consentement,
  EVENEMENT_OUVRIR,
  enregistrerConsentement,
} from "@/lib/consentement";

/**
 * Bandeau de consentement aux traceurs. Refuser est aussi direct qu'accepter
 * (deux boutons de même rang), et « Personnaliser » choisit finalité par
 * finalité. Il s'affiche quand aucun choix valide n'est enregistré, ou quand
 * le pied de page le rouvre. Non modal : la page reste utilisable, et rien
 * n'est chargé tant qu'il n'a pas reçu de réponse.
 *
 * `consentement` vaut `undefined` tant que le navigateur ne l'a pas lu
 * (rendu serveur, hydratation) : le bandeau reste alors masqué, ce qui évite
 * qu'il clignote chez ceux qui ont déjà choisi.
 */
export function BandeauConsentement({
  consentement,
}: {
  consentement: Consentement | null | undefined;
}) {
  const { t } = useLanguage();
  const id = useId();
  const [rouvert, setRouvert] = useState(false);
  const [details, setDetails] = useState(false);
  const [mesure, setMesure] = useState(false);
  const [pub, setPub] = useState(false);

  useEffect(() => {
    const rouvrir = () => {
      setMesure(consentement?.mesure ?? false);
      setPub(consentement?.pub ?? false);
      setDetails(true);
      setRouvert(true);
    };
    addEventListener(EVENEMENT_OUVRIR, rouvrir);
    return () => removeEventListener(EVENEMENT_OUVRIR, rouvrir);
  }, [consentement]);

  const choisir = useCallback((choix: { mesure: boolean; pub: boolean }) => {
    enregistrerConsentement(choix);
    setRouvert(false);
    setDetails(false);
  }, []);
  const toutRefuser = useCallback(
    () => choisir({ mesure: false, pub: false }),
    [choisir],
  );
  const toutAccepter = useCallback(
    () => choisir({ mesure: true, pub: true }),
    [choisir],
  );
  const enregistrer = useCallback(
    () => choisir({ mesure, pub }),
    [choisir, mesure, pub],
  );
  const personnaliser = useCallback(() => setDetails(true), []);
  const basculerMesure = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setMesure(e.currentTarget.checked),
    [],
  );
  const basculerPub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setPub(e.currentTarget.checked),
    [],
  );

  if (!rouvert && consentement !== null) return null;

  return (
    <section
      aria-labelledby={`${id}-titre`}
      className="fixed inset-x-3 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-2xl rounded-2xl border border-outline-variant bg-surface-container-high p-4 text-on-surface shadow-lg md:bottom-4"
    >
      <h2 id={`${id}-titre`} className="text-base font-semibold">
        {t("consent.title")}
      </h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        {t("consent.body")}{" "}
        <Link
          href="/legal/confidentialite"
          className="underline underline-offset-2 hover:text-primary"
        >
          {t("consent.policy")}
        </Link>
      </p>

      {details && (
        <fieldset className="mt-3 space-y-2 text-sm">
          <legend className="sr-only">{t("consent.customize")}</legend>
          <div className="flex min-h-11 items-start gap-3">
            <input
              id={`${id}-mesure`}
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={mesure}
              onChange={basculerMesure}
              aria-describedby={`${id}-mesure-aide`}
            />
            <div>
              <label htmlFor={`${id}-mesure`} className="font-medium">
                {t("consent.analytics")}
              </label>
              <p id={`${id}-mesure-aide`} className="text-on-surface-variant">
                {t("consent.analytics.help")}
              </p>
            </div>
          </div>
          <div className="flex min-h-11 items-start gap-3">
            <input
              id={`${id}-pub`}
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={pub}
              onChange={basculerPub}
              aria-describedby={`${id}-pub-aide`}
            />
            <div>
              <label htmlFor={`${id}-pub`} className="font-medium">
                {t("consent.ads")}
              </label>
              <p id={`${id}-pub-aide`} className="text-on-surface-variant">
                {t("consent.ads.help")}
              </p>
            </div>
          </div>
        </fieldset>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {details ? (
          <Button variant="outline" className="min-h-11" onClick={enregistrer}>
            {t("consent.save")}
          </Button>
        ) : (
          <Button variant="ghost" className="min-h-11" onClick={personnaliser}>
            {t("consent.customize")}
          </Button>
        )}
        <Button variant="outline" className="min-h-11" onClick={toutRefuser}>
          {t("consent.reject")}
        </Button>
        <Button variant="outline" className="min-h-11" onClick={toutAccepter}>
          {t("consent.accept")}
        </Button>
      </div>
    </section>
  );
}
