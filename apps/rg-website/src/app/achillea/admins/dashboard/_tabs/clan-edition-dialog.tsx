"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  NativeSelect,
  NativeSelectOption,
  Switch,
  Textarea,
} from "@rosegriffon/ui";
import { ImageUp, Loader2, Save } from "lucide-react";
import { COUNTRIES } from "@rosegriffon/achillea-core/reference";
import type { ClanDTO } from "@rosegriffon/achillea-types/domain/clan";
import { signalerEchec } from "@/lib/achillea/signaler";
import { useClientAchillea } from "./etat";
import {
  BIO_MAX,
  NOM_MAX,
  TAG_MAX,
  patchClan,
  saisieDepuisClan,
  validerSaisieClan,
  type ChampClan,
  type ErreursClan,
  type SaisieClan,
} from "./clan-edition";

const CODES_PAYS: ReadonlySet<string> = new Set(COUNTRIES.map(pays => pays.code));
/** Mêmes limites que l'ancien téléversement : 6 Mo, images courantes. */
const LOGO_TAILLE_MAX = 6_000_000;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function MessageChamp({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

function Bascule({
  id,
  libelle,
  aide,
  valeur,
  onChange,
}: {
  id: string;
  libelle: string;
  aide?: string;
  valeur: boolean;
  onChange: (valeur: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-start justify-between gap-4 rounded-lg border border-border/60 p-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer">
          {libelle}
        </Label>
        {aide && <p className="mt-1 text-xs text-muted-foreground">{aide}</p>}
      </div>
      <Switch id={id} checked={valeur} onCheckedChange={onChange} />
    </div>
  );
}

/**
 * Fenêtre d'édition complète d'un clan (portage de `ClanInfoForm`, contexte
 * admin) : logo, nom, tag, biographie, réseaux, recrutement, acceptation
 * automatique, origine, langues ; inactif et masqué pour un administrateur.
 */
export function EditionClanDialog({
  clan,
  estAdmin,
  onFermer,
  onEnregistre,
}: {
  clan: ClanDTO | null;
  estAdmin: boolean;
  onFermer: () => void;
  onEnregistre: (nom: string) => void;
}) {
  return (
    <Dialog open={clan !== null} onOpenChange={ouvert => !ouvert && onFermer()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {clan && <FormulaireClan key={clan.id} clan={clan} estAdmin={estAdmin} onFermer={onFermer} onEnregistre={onEnregistre} />}
      </DialogContent>
    </Dialog>
  );
}

function FormulaireClan({
  clan,
  estAdmin,
  onFermer,
  onEnregistre,
}: {
  clan: ClanDTO;
  estAdmin: boolean;
  onFermer: () => void;
  onEnregistre: (nom: string) => void;
}) {
  const client = useClientAchillea();
  const [initial] = useState(() => saisieDepuisClan(clan));
  const [saisie, setSaisie] = useState<SaisieClan>(initial);
  const [erreurs, setErreurs] = useState<ErreursClan>({});
  const [erreurApi, setErreurApi] = useState<string | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [televersement, setTeleversement] = useState(false);
  const fichier = useRef<HTMLInputElement>(null);

  const modifier = <C extends ChampClan>(champ: C, valeur: SaisieClan[C]) => {
    setSaisie(courante => ({ ...courante, [champ]: valeur }));
    setErreurs(courantes => ({ ...courantes, [champ]: undefined }));
  };

  const patch = patchClan(initial, saisie, estAdmin);
  const modifie = Object.keys(patch).length > 0;

  const televerserLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const choisi = event.target.files?.[0];
    event.target.value = "";
    if (!choisi) return;
    if (!LOGO_TYPES.includes(choisi.type)) {
      setErreurs(courantes => ({ ...courantes, clanAvatarUrl: "Formats acceptés : PNG, JPEG, WebP, GIF." }));
      return;
    }
    if (choisi.size > LOGO_TAILLE_MAX) {
      setErreurs(courantes => ({ ...courantes, clanAvatarUrl: "Image trop lourde (6 Mo au plus)." }));
      return;
    }
    setTeleversement(true);
    try {
      const resultat = await client.admin.uploadImage(choisi, choisi.name);
      if (resultat.ok) modifier("clanAvatarUrl", resultat.value.url);
      else setErreurs(courantes => ({ ...courantes, clanAvatarUrl: signalerEchec("proxy/upload", resultat) }));
    } finally {
      setTeleversement(false);
    }
  };

  const enregistrer = async (event: FormEvent) => {
    event.preventDefault();
    const trouvees = validerSaisieClan(saisie, CODES_PAYS, initial);
    setErreurs(trouvees);
    setErreurApi(null);
    if (Object.keys(trouvees).length > 0 || !modifie) return;
    setEnregistrement(true);
    try {
      const resultat = await client.clans.update(clan.id, patch);
      if (resultat.ok && resultat.value.success) onEnregistre(saisie.name.trim());
      else if (resultat.ok) setErreurApi(resultat.value.error ?? "Le clan n'a pas pu être mis à jour.");
      else setErreurApi(signalerEchec("clans/update", resultat));
    } finally {
      setEnregistrement(false);
    }
  };

  const champTexte = (champ: "name" | "shortenedName" | "xUrl" | "instagramUrl" | "tiktokUrl", libelle: string, extra: { maxLength?: number; placeholder?: string } = {}) => {
    const id = `clan-edition-${champ}`;
    return (
      <div className="space-y-1">
        <Label htmlFor={id}>{libelle}</Label>
        <Input
          id={id}
          value={saisie[champ]}
          onChange={event => modifier(champ, event.target.value)}
          aria-invalid={Boolean(erreurs[champ])}
          aria-describedby={erreurs[champ] ? `${id}-erreur` : undefined}
          autoComplete="off"
          className="min-h-11"
          {...extra}
        />
        <MessageChamp id={`${id}-erreur`} message={erreurs[champ]} />
      </div>
    );
  };

  return (
    <form onSubmit={event => void enregistrer(event)} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>Éditer {clan.name}</DialogTitle>
        <DialogDescription>Les modifications s&apos;appliquent aussi au rôle et au salon Discord du clan.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <Avatar className="size-24 rounded-xl">
            {saisie.clanAvatarUrl && <AvatarImage src={saisie.clanAvatarUrl} alt={`Logo de ${clan.name}`} />}
            <AvatarFallback className="rounded-xl">{saisie.shortenedName.slice(0, 3)}</AvatarFallback>
          </Avatar>
          <input
            ref={fichier}
            type="file"
            accept={LOGO_TYPES.join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={event => void televerserLogo(event)}
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 gap-2"
            disabled={televersement}
            onClick={() => fichier.current?.click()}
          >
            {televersement ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ImageUp className="size-4" aria-hidden="true" />
            )}
            Changer le logo
          </Button>
          <MessageChamp id="clan-edition-logo-erreur" message={erreurs.clanAvatarUrl} />
        </div>

        <div className="grid w-full gap-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            {champTexte("name", "Nom", { maxLength: NOM_MAX })}
            {champTexte("shortenedName", "Tag", { maxLength: TAG_MAX })}
          </div>
          <div className="space-y-1">
            <Label htmlFor="clan-edition-bio">Biographie</Label>
            <Textarea
              id="clan-edition-bio"
              rows={4}
              value={saisie.clanBiography}
              onChange={event => modifier("clanBiography", event.target.value)}
              aria-invalid={Boolean(erreurs.clanBiography)}
              aria-describedby="clan-edition-bio-compte"
            />
            <p id="clan-edition-bio-compte" className="text-xs text-muted-foreground">
              {saisie.clanBiography.length} / {BIO_MAX}
            </p>
            <MessageChamp id="clan-edition-bio-erreur" message={erreurs.clanBiography} />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {champTexte("xUrl", "X / Twitter", { placeholder: "https://x.com/…" })}
            {champTexte("instagramUrl", "Instagram", { placeholder: "https://instagram.com/…" })}
            {champTexte("tiktokUrl", "TikTok", { placeholder: "https://tiktok.com/@…" })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="clan-edition-origine">Origine</Label>
          <NativeSelect
            id="clan-edition-origine"
            value={saisie.origin}
            onChange={event => modifier("origin", event.target.value)}
            aria-invalid={Boolean(erreurs.origin)}
            className="min-h-11"
          >
            {!CODES_PAYS.has(saisie.origin) && <NativeSelectOption value={saisie.origin}>Non renseignée</NativeSelectOption>}
            {COUNTRIES.map(pays => (
              <NativeSelectOption key={pays.code} value={pays.code}>
                {pays.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <MessageChamp id="clan-edition-origine-erreur" message={erreurs.origin} />
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm font-medium">Langues parlées</legend>
          <div className="grid grid-cols-2 gap-1">
            {COUNTRIES.map(pays => {
              const id = `clan-edition-langue-${pays.code}`;
              const coche = saisie.languages.includes(pays.code);
              return (
                <div key={pays.code} className="flex min-h-11 items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={coche}
                    onCheckedChange={valeur =>
                      modifier(
                        "languages",
                        valeur === true
                          ? [...saisie.languages, pays.code]
                          : saisie.languages.filter(code => code !== pays.code),
                      )
                    }
                  />
                  <Label htmlFor={id} className="cursor-pointer font-normal">
                    {pays.language}
                  </Label>
                </div>
              );
            })}
          </div>
          <MessageChamp id="clan-edition-langues-erreur" message={erreurs.languages} />
        </fieldset>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Bascule
          id="clan-edition-recrutement"
          libelle="Recrutement ouvert"
          valeur={saisie.isRecruiting}
          onChange={valeur => modifier("isRecruiting", valeur)}
        />
        <Bascule
          id="clan-edition-auto"
          libelle="Candidatures acceptées automatiquement"
          valeur={saisie.autoAcceptMembers}
          onChange={valeur => modifier("autoAcceptMembers", valeur)}
        />
        {estAdmin && (
          <>
            <Bascule
              id="clan-edition-inactif"
              libelle="Clan inactif"
              aide="Signale le clan comme en sommeil."
              valeur={saisie.isInactive}
              onChange={valeur => modifier("isInactive", valeur)}
            />
            <Bascule
              id="clan-edition-masque"
              libelle="Clan masqué"
              aide="Retire le clan des listes et du classement publics."
              valeur={saisie.isHidden}
              onChange={valeur => modifier("isHidden", valeur)}
            />
          </>
        )}
      </div>

      {erreurApi && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {erreurApi}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" className="min-h-11" onClick={onFermer}>
          Annuler
        </Button>
        <Button type="submit" className="min-h-11 gap-2" disabled={enregistrement || televersement || !modifie}>
          {enregistrement ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" aria-hidden="true" />
          )}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}
