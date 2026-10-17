import { Suspense } from "react";
import { Activity, FileText, Globe, Server } from "lucide-react";

import {
  AdminPageHeader,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@rosegriffon/ui";

import { LIBELLES_GARDE, pagesPubliques, type GardeRoute } from "@/lib/admin/routes";
import { inventaireRoutes } from "@/lib/admin/routes-systeme";
import { estSain, sonder, type ResultatSonde } from "@/lib/admin/sondes";
import { ROUTES_SITEMAP } from "@/lib/site-routes";
import { SITE_URL } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export const metadata = {
  description: "Routes API réelles, tests de santé et code HTTP de chaque page publique.",
  title: "API et pages — Administration",
};

/** Les trois sondes de santé exigées : chemin, rôle de la sonde. */
const SANTE = [
  { chemin: "/api/health", libelle: "Santé du site et de la base" },
  { chemin: "/api/feed/live", libelle: "Flux en direct" },
  { chemin: "/api/auth/get-session", libelle: "Session (Better Auth)" },
] as const;

const VARIANTE_GARDE: Record<GardeRoute, "default" | "secondary" | "outline" | "destructive"> = {
  admin: "destructive",
  cle: "secondary",
  createur: "secondary",
  public: "outline",
  session: "default",
};

function BadgeStatut({ resultat }: { resultat: ResultatSonde | undefined }) {
  if (!resultat) return <span className="text-muted-foreground">—</span>;
  if (resultat.statut === null) {
    return (
      <span className="font-medium text-destructive" title={resultat.erreur ?? undefined}>
        Aucune réponse
      </span>
    );
  }
  const classe = estSain(resultat.statut)
    ? "text-succes"
    : resultat.statut >= 300 && resultat.statut < 400
      ? "text-alerte"
      : "text-destructive";
  return <span className={`font-mono font-medium ${classe}`}>{resultat.statut}</span>;
}

async function SectionSante() {
  const resultats = await sonder(SANTE.map(s => `${SITE_URL}${s.chemin}`));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4" aria-hidden />
          Tests de santé
        </CardTitle>
        <CardDescription>Requêtes réelles vers {SITE_URL}, mises en cache 60 s.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Code HTTP</TableHead>
              <TableHead>Durée</TableHead>
              <TableHead>État</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SANTE.map((sonde, i) => {
              const r = resultats[i];
              return (
                <TableRow key={sonde.chemin}>
                  <TableCell className="font-mono text-xs">{sonde.chemin}</TableCell>
                  <TableCell>{sonde.libelle}</TableCell>
                  <TableCell>
                    <BadgeStatut resultat={r} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r ? `${r.dureeMs} ms` : "—"}</TableCell>
                  <TableCell>
                    {estSain(r?.statut ?? null) ? (
                      <Badge variant="outline" className="text-succes">
                        Sain
                      </Badge>
                    ) : (
                      <Badge variant="destructive">Défaillant</Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

async function SectionApi() {
  const inventaire = await inventaireRoutes();
  const parGarde = new Map<GardeRoute, number>();
  for (const r of inventaire.api) parGarde.set(r.garde, (parGarde.get(r.garde) ?? 0) + 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Server className="size-4" aria-hidden />
          API ({inventaire.api.length} routes)
        </CardTitle>
        <CardDescription>
          Parcours de l&apos;arborescence <code>app/api</code>
          {inventaire.origine === "build" ? " via le manifeste de build" : ""}. La garde est déduite du code de chaque
          route : une route sans garde reconnue est listée « Public ».{" "}
          {[...parGarde.entries()].map(([g, n]) => `${LIBELLES_GARDE[g]} : ${n}`).join(" · ")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {inventaire.api.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune route lisible : ni <code>src/app</code> ni le manifeste <code>.next</code> n&apos;ont été trouvés.
          </p>
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Méthodes</TableHead>
                  <TableHead>Garde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventaire.api.map(route => (
                  <TableRow key={route.route}>
                    <TableCell className="font-mono text-xs">{route.route}</TableCell>
                    <TableCell className="font-mono text-xs">{route.methodes.join(", ") || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={VARIANTE_GARDE[route.garde]}>{LIBELLES_GARDE[route.garde]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function SectionPages() {
  const inventaire = await inventaireRoutes();
  const chemins = pagesPubliques(inventaire.pages);
  const dansSitemap = new Set(ROUTES_SITEMAP.map(r => r.path));
  const resultats = await sonder(chemins.map(c => `${SITE_URL}${c === "/" ? "" : c}`));
  const enErreur = resultats.filter(r => r.statut === null || r.statut >= 400).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="size-4" aria-hidden />
          Pages publiques ({chemins.length})
        </CardTitle>
        <CardDescription>
          Pages statiques de <code>app/</code> hors zones privées, sondées en direct (4 en parallèle, cache 60 s).{" "}
          {enErreur > 0 ? `${enErreur} en erreur.` : "Aucune erreur."} Les redirections ne sont pas suivies : un 301 est
          affiché tel quel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {chemins.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune page lisible dans l&apos;arborescence.</p>
        ) : (
          <div className="max-h-[32rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Page</TableHead>
                  <TableHead>Code HTTP</TableHead>
                  <TableHead>Durée</TableHead>
                  <TableHead>Sitemap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {chemins.map((chemin, i) => (
                  <TableRow key={chemin}>
                    <TableCell className="font-mono text-xs">{chemin}</TableCell>
                    <TableCell>
                      <BadgeStatut resultat={resultats[i]} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {resultats[i] ? `${resultats[i]!.dureeMs} ms` : "—"}
                    </TableCell>
                    <TableCell>
                      {dansSitemap.has(chemin) ? (
                        <span className="text-succes">Oui</span>
                      ) : (
                        <span className="text-muted-foreground">Non</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Squelette({ titre }: { titre: string }) {
  return (
    <Card role="status" aria-busy="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4" aria-hidden />
          {titre}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <span className="sr-only">Chargement en cours…</span>
        <Skeleton className="h-48 w-full" />
      </CardContent>
    </Card>
  );
}

export default function RoutesPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <AdminPageHeader
        breadcrumbs={[{ href: "/admin", label: "Administration" }, { label: "API et pages" }]}
        icon={<Server className="size-5" />}
        title="API et pages"
        description="Ce qui existe vraiment : routes API et leur garde, santé des points d'entrée, code HTTP des pages publiques."
      />
      <Suspense fallback={<Squelette titre="Tests de santé" />}>
        <SectionSante />
      </Suspense>
      <Suspense fallback={<Squelette titre="API" />}>
        <SectionApi />
      </Suspense>
      <Suspense fallback={<Squelette titre="Pages publiques" />}>
        <SectionPages />
      </Suspense>
    </div>
  );
}
