"use client";

/**
 * Avatar `chara_edit` : coller le code de partage de l'éditeur (ou partir d'un avatar créé dans
 * l'atelier du wiki), le valider, voir le rendu 3D réel et l'enregistrer sur le profil.
 */

import { Button } from "@rosegriffon/ui/button";
import { Textarea } from "@rosegriffon/ui/textarea";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { listerAvatars, type Sauvegarde } from "@/app/wiki/avatar/actions";

import { enregistrerAvatarJeu, resoudreCode, type ApercuCode } from "../avatar-jeu-actions";
import { ApercuAvatar, type ApercuAvatarHandle } from "./ApercuAvatar";

const COTE_INSTANTANE = 512;

export function AvatarCode({ codeActuel, onSaved }: { codeActuel: string | null; onSaved: () => void }) {
  const idCode = useId();
  const idErreur = useId();
  const [saisie, setSaisie] = useState(codeActuel ?? "");
  const [apercu, setApercu] = useState<ApercuCode | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [verification, setVerification] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [sauvegardes, setSauvegardes] = useState<Sauvegarde[] | null>(null);
  const [erreurListe, setErreurListe] = useState<string | null>(null);
  const handle = useRef<ApercuAvatarHandle>(null);

  useEffect(() => {
    let annule = false;
    void listerAvatars()
      .then(r => {
        if (annule) return;
        if (r.error) setErreurListe(r.error);
        setSauvegardes((r.avatars ?? []).filter(a => a.code));
      })
      .catch(() => {
        if (!annule) {
          setErreurListe("Tes avatars enregistrés sont injoignables.");
          setSauvegardes([]);
        }
      });
    return () => {
      annule = true;
    };
  }, []);

  const verifier = async (texte: string) => {
    setVerification(true);
    setErreur(null);
    setApercu(null);
    const r = await resoudreCode(texte).catch(() => ({ error: "Le service de rendu est injoignable." }));
    setVerification(false);
    if ("error" in r) setErreur(r.error);
    else setApercu(r);
  };

  const enregistrer = async () => {
    if (!apercu || !handle.current) return;
    setEnvoi(true);
    try {
      const image = await handle.current.capturer(COTE_INSTANTANE);
      const formulaire = new FormData();
      formulaire.set("code", apercu.code);
      formulaire.set("image", new File([image], "avatar.png", { type: "image/png" }));
      const r = await enregistrerAvatarJeu(formulaire);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Avatar du jeu enregistré.");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={idCode} className="text-sm font-medium">
          Code de partage ou lien
        </label>
        <Textarea
          id={idCode}
          value={saisie}
          onChange={e => {
            setSaisie(e.target.value);
            setApercu(null);
            setErreur(null);
          }}
          rows={3}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? idErreur : undefined}
          className="font-mono text-sm break-all"
          placeholder="Colle ici le code de 69 caractères"
        />
        {erreur && (
          <p id={idErreur} role="alert" className="text-sm text-destructive">
            {erreur}
          </p>
        )}
        <Button className="h-11" disabled={verification || saisie.trim().length === 0} onClick={() => verifier(saisie)}>
          {verification && <Loader2 className="animate-spin" aria-hidden />}
          Vérifier et afficher
        </Button>
      </div>

      <section aria-labelledby={`${idCode}-mes`} className="flex flex-col gap-2">
        <h3 id={`${idCode}-mes`} className="text-sm font-medium">
          Mes avatars de l&apos;atelier
        </h3>
        {sauvegardes === null ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : erreurListe ? (
          <p className="text-sm text-muted-foreground">{erreurListe}</p>
        ) : sauvegardes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun avatar enregistré.{" "}
            <Link href="/wiki/avatar" className="underline underline-offset-2">
              Crée-en un dans l&apos;atelier
            </Link>
            .
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sauvegardes.map(s => (
              <li key={s.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border px-3 text-left text-sm hover:border-primary/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-hidden"
                  onClick={() => {
                    setSaisie(s.code ?? "");
                    void verifier(s.code ?? "");
                  }}
                >
                  <span className="truncate">{s.nom}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">Afficher</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {apercu && (
        <section aria-label="Aperçu de l'avatar" className="flex flex-col gap-3">
          <ApercuAvatar url={apercu.apercu} handleRef={handle} />
          {!apercu.complet && (
            <p className="text-xs text-muted-foreground">
              Ce code ne porte que les pièces et la morphologie ; couleurs et curseurs viennent d&apos;un avatar
              enregistré dans l&apos;atelier.
            </p>
          )}
          <div className="sticky bottom-0 bg-background/95 py-2 backdrop-blur">
            <Button className="h-11 w-full" disabled={envoi} onClick={enregistrer}>
              {envoi && <Loader2 className="animate-spin" aria-hidden />}
              Utiliser comme avatar
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
