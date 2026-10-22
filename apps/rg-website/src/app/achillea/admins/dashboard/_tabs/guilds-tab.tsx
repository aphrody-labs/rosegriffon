"use client";

import { useState } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rosegriffon/ui";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { signalerEchec } from "@/lib/achillea/signaler";
import type { AdminGuildRow } from "@rosegriffon/achillea-types/domain/admin";
import { BoutonActualiser, Chargement, Erreur, Vide, useClientAchillea, useLecture } from "./etat";

/** Nom d'une commande slash, quelle que soit la forme renvoyée par `/admin/ops/commands`. */
function nomCommande(commande: unknown): string | null {
  if (commande && typeof commande === "object" && "name" in commande) {
    const nom = (commande as { name: unknown }).name;
    return typeof nom === "string" ? nom : null;
  }
  return null;
}

/**
 * « Serveurs Discord » — serveurs où le bot est présent, invitations et
 * commandes enregistrées (SuperAdmin). Les données viennent de la passerelle
 * Discord via `/admin/ops/*`.
 */
export function GuildsTab() {
  const client = useClientAchillea();
  const serveurs = useLecture("admin/ops/guilds", () => client.admin.guilds());
  const commandes = useLecture("admin/ops/commands", () => client.admin.commands());
  const [invitationEnCours, setInvitationEnCours] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<{ guild: AdminGuildRow; url: string } | null>(null);
  const [erreurInvitation, setErreurInvitation] = useState<string | null>(null);
  const [copie, setCopie] = useState<"ok" | "echec" | null>(null);

  const inviter = async (guild: AdminGuildRow) => {
    setInvitationEnCours(guild.id);
    setInvitation(null);
    setErreurInvitation(null);
    setCopie(null);
    try {
      const resultat = await client.admin.guildInvite(guild.id);
      if (resultat.ok) setInvitation({ guild, url: resultat.value.url });
      else setErreurInvitation(signalerEchec("admin/ops/guilds/invite", resultat));
    } finally {
      setInvitationEnCours(null);
    }
  };

  const copier = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopie("ok");
    } catch {
      // Pas de presse-papier (contexte non sécurisé) : l'URL reste affichée.
      setCopie("echec");
    }
  };

  const liste = serveurs.donnees?.data ?? [];
  const nomsCommandes = (commandes.donnees?.data ?? []).map(nomCommande).filter((nom): nom is string => !!nom);

  return (
    <div className="space-y-6">
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-base">Serveurs Discord ({liste.length})</CardTitle>
            <p className="text-xs text-muted-foreground">Serveurs où le bot est présent (cache de la passerelle).</p>
          </div>
          <BoutonActualiser
            enCours={serveurs.chargement}
            onClick={() => {
              serveurs.recharger();
              commandes.recharger();
            }}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {serveurs.erreur && <Erreur message={serveurs.erreur} onReessayer={serveurs.recharger} />}
          {serveurs.chargement && !serveurs.donnees ? (
            <Chargement />
          ) : liste.length === 0 && !serveurs.erreur ? (
            <Vide message="Aucun serveur remonté par la passerelle Discord." />
          ) : (
            liste.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serveur</TableHead>
                    <TableHead className="text-right">Membres</TableHead>
                    <TableHead>Propriétaire (ID)</TableHead>
                    <TableHead>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liste.map(guild => (
                    <TableRow key={guild.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Avatar className="size-7">
                            {guild.iconURL && <AvatarImage src={guild.iconURL} alt="" />}
                            <AvatarFallback className="text-xs">{guild.name.slice(0, 2)}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{guild.name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{guild.memberCount}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{guild.ownerId}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          className="min-h-11 gap-2"
                          disabled={invitationEnCours === guild.id}
                          onClick={() => void inviter(guild)}
                          aria-label={`Créer une invitation pour ${guild.name}`}
                        >
                          {invitationEnCours === guild.id ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Link2 className="size-4" aria-hidden="true" />
                          )}
                          Inviter
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          )}

          {erreurInvitation && <Erreur message={`Invitation impossible : ${erreurInvitation}`} />}
          {invitation && (
            <div className="flex flex-col gap-2 rounded-xl border border-success/40 bg-success/10 p-3 text-sm sm:flex-row sm:items-center">
              <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
              <span className="sr-only">Invitation pour {invitation.guild.name} :</span>
              <code className="flex-1 truncate select-all">{invitation.url}</code>
              <Button
                variant="outline"
                className="min-h-11 gap-2"
                onClick={() => void copier(invitation.url)}
                aria-label="Copier le lien d'invitation"
              >
                <Copy className="size-4" aria-hidden="true" />
                Copier
              </Button>
              <span aria-live="polite" className="text-xs text-muted-foreground">
                {copie === "ok" ? "Copié." : copie === "echec" ? "Copie impossible : sélectionne le lien." : ""}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Commandes ({nomsCommandes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {commandes.erreur && <Erreur message={commandes.erreur} onReessayer={commandes.recharger} />}
          {commandes.chargement && !commandes.donnees ? (
            <Chargement lignes={1} />
          ) : nomsCommandes.length === 0 && !commandes.erreur ? (
            <Vide message="Aucune commande enregistrée." />
          ) : (
            <ul className="flex flex-wrap gap-2">
              {nomsCommandes.map(nom => (
                <li key={nom}>
                  <Badge variant="secondary">/{nom}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
