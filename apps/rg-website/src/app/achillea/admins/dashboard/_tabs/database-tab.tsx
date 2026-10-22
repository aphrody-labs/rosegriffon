"use client";

import { useState, type FormEvent } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@rosegriffon/ui";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Database,
  KeyRound,
  Loader2,
  Lock,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { signalerEchec } from "@/lib/achillea/signaler";
import type { AchilleaClientResult } from "@rosegriffon/achillea-client";
import type { DbColumn, DbQueryResult, DbRowsPage } from "@rosegriffon/achillea-types/domain/admin";
import { SauvegardesBase } from "./database-sauvegardes";
import { BoutonActualiser, Chargement, Erreur, Vide, useClientAchillea, useLecture } from "./etat";
import {
  apercuCellule,
  clePrimaire,
  genreColonne,
  messageRefusDb,
  valeursInsertion,
  valeursModifiees,
  versSaisie,
} from "./database-valeurs";

const LIGNES_PAR_PAGE = 25;

/**
 * Message d'échec : le texte de l'API (« Requête refusée : … ») quand il existe,
 * sinon le statut traduit selon le contrat `/admin/db`, sinon le message générique.
 */
function messageEchec(contexte: string, resultat: AchilleaClientResult<unknown>): string {
  if (resultat.ok) return "";
  const affiche = signalerEchec(contexte, resultat);
  if (resultat.kind !== "http" || resultat.message?.trim()) return affiche;
  return messageRefusDb(resultat.status) ?? affiche;
}

function GrilleResultats({ colonnes, lignes }: { colonnes: string[]; lignes: Array<Record<string, unknown>> }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {colonnes.map(nom => (
              <TableHead key={nom} className="font-mono text-xs">
                {nom}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {lignes.map((ligne, index) => (
            <TableRow key={index}>
              {colonnes.map(nom => (
                <TableCell key={nom} className="max-w-xs truncate font-mono text-xs" title={apercuCellule(ligne[nom])}>
                  {apercuCellule(ligne[nom])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type Edition = {
  nouvelle: boolean;
  pk: Record<string, unknown> | null;
  initiale: Record<string, string>;
  courante: Record<string, string>;
};

function NavigateurTables() {
  const client = useClientAchillea();
  const tables = useLecture("admin/db/tables", () => client.admin.dbTables());
  const [filtre, setFiltre] = useState("");
  const [table, setTable] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [tri, setTri] = useState<{ colonne: string; ordre: "asc" | "desc" } | null>(null);
  const [lignes, setLignes] = useState<DbRowsPage | null>(null);
  const [lignesChargement, setLignesChargement] = useState(false);
  const [lignesErreur, setLignesErreur] = useState<string | null>(null);
  const [edition, setEdition] = useState<Edition | null>(null);
  const [enregistrement, setEnregistrement] = useState(false);
  const [erreurEdition, setErreurEdition] = useState<string | null>(null);
  const [suppression, setSuppression] = useState<string | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  const infosTable = tables.donnees?.data.find(entree => entree.name === table) ?? null;
  const colonnes: DbColumn[] = lignes?.columns ?? [];
  const aCle = colonnes.some(colonne => colonne.isPrimaryKey);
  const modifiable = !!infosTable && !infosTable.protected;
  const totalPages = Math.max(1, lignes?.meta.pageCount ?? Math.ceil((lignes?.meta.total ?? 0) / LIGNES_PAR_PAGE));

  const chargerLignes = async (
    nom: string,
    pageCible: number,
    triCible: { colonne: string; ordre: "asc" | "desc" } | null,
  ) => {
    setLignesChargement(true);
    setLignesErreur(null);
    try {
      const resultat = await client.admin.dbRows(nom, {
        page: pageCible,
        limit: LIGNES_PAR_PAGE,
        sort: triCible?.colonne,
        order: triCible?.ordre,
      });
      if (resultat.ok) setLignes(resultat.value);
      else setLignesErreur(messageEchec("admin/db/rows", resultat));
    } finally {
      setLignesChargement(false);
    }
  };

  const choisirTable = (nom: string) => {
    setTable(nom);
    setPage(1);
    setTri(null);
    setLignes(null);
    setErreurAction(null);
    void chargerLignes(nom, 1, null);
  };

  const changerPage = (cible: number) => {
    if (!table) return;
    setPage(cible);
    void chargerLignes(table, cible, tri);
  };

  const trierPar = (colonne: string) => {
    if (!table) return;
    const suivant: { colonne: string; ordre: "asc" | "desc" } =
      tri?.colonne === colonne && tri.ordre === "asc" ? { colonne, ordre: "desc" } : { colonne, ordre: "asc" };
    setTri(suivant);
    setPage(1);
    void chargerLignes(table, 1, suivant);
  };

  const ouvrirEdition = (ligne: Record<string, unknown> | null) => {
    const saisie: Record<string, string> = {};
    for (const colonne of colonnes) {
      if (ligne) saisie[colonne.name] = versSaisie(ligne[colonne.name], genreColonne(colonne.dataType));
      else if (!(colonne.isPrimaryKey && colonne.default)) saisie[colonne.name] = "";
    }
    setErreurEdition(null);
    setEdition({
      nouvelle: ligne === null,
      pk: ligne ? clePrimaire(colonnes, ligne) : null,
      initiale: saisie,
      courante: { ...saisie },
    });
  };

  const enregistrer = async (event: FormEvent) => {
    event.preventDefault();
    if (!edition || !table) return;
    let valeurs: Record<string, unknown>;
    try {
      valeurs = edition.nouvelle
        ? valeursInsertion(colonnes, edition.courante)
        : valeursModifiees(colonnes, edition.initiale, edition.courante);
    } catch (cause) {
      setErreurEdition(cause instanceof Error ? cause.message : "Saisie invalide.");
      return;
    }
    if (Object.keys(valeurs).length === 0) {
      setErreurEdition(edition.nouvelle ? "Aucune valeur saisie." : "Aucune modification.");
      return;
    }
    setEnregistrement(true);
    setErreurEdition(null);
    try {
      const resultat = edition.nouvelle
        ? await client.admin.dbInsertRow(table, valeurs)
        : await client.admin.dbUpdateRow(table, edition.pk ?? {}, valeurs);
      if (resultat.ok) {
        setEdition(null);
        void chargerLignes(table, page, tri);
      } else setErreurEdition(messageEchec("admin/db/rows:write", resultat));
    } finally {
      setEnregistrement(false);
    }
  };

  const supprimer = async (ligne: Record<string, unknown>) => {
    if (!table) return;
    const pk = clePrimaire(colonnes, ligne);
    if (!pk) return;
    const libelle = JSON.stringify(pk);
    if (!confirm(`Supprimer définitivement la ligne ${libelle} de « ${table} » ?`)) return;
    setSuppression(libelle);
    setErreurAction(null);
    try {
      const resultat = await client.admin.dbDeleteRow(table, pk);
      if (resultat.ok) void chargerLignes(table, page, tri);
      else setErreurAction(messageEchec("admin/db/rows:delete", resultat));
    } finally {
      setSuppression(null);
    }
  };

  const listeTables = (tables.donnees?.data ?? []).filter(entree =>
    entree.name.toLowerCase().includes(filtre.trim().toLowerCase()),
  );

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
      <Card className="border-border/60">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">Tables</CardTitle>
            <BoutonActualiser enCours={tables.chargement} onClick={tables.recharger} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="db-filtre-tables">Filtrer</Label>
            <Input
              id="db-filtre-tables"
              value={filtre}
              onChange={event => setFiltre(event.target.value)}
              className="min-h-11"
            />
          </div>
        </CardHeader>
        <CardContent>
          {tables.erreur && <Erreur message={tables.erreur} onReessayer={tables.recharger} />}
          {tables.chargement && !tables.donnees ? (
            <Chargement lignes={4} />
          ) : listeTables.length === 0 && !tables.erreur ? (
            <Vide message="Aucune table." />
          ) : (
            <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
              {listeTables.map(entree => (
                <li key={entree.name}>
                  <Button
                    variant={entree.name === table ? "default" : "ghost"}
                    className="min-h-11 w-full justify-between gap-2 font-mono text-xs"
                    onClick={() => choisirTable(entree.name)}
                    aria-pressed={entree.name === table}
                  >
                    <span className="flex items-center gap-1 truncate">
                      {entree.protected && <Lock className="size-3" aria-label="protégée" />}
                      {entree.name}
                    </span>
                    <span className="opacity-70">~{entree.estimatedRows}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-border/60">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-sm">
              {table ?? "Choisis une table"}
              {infosTable?.protected && <Badge variant="warning">Protégée — lecture seule</Badge>}
              {infosTable && !infosTable.protected && lignes && !aCle && (
                <Badge variant="secondary">Sans clé primaire — lecture seule</Badge>
              )}
            </CardTitle>
            {lignes && <p className="text-xs text-muted-foreground">{lignes.meta.total} lignes</p>}
          </div>
          {table && modifiable && lignes && (
            <Button variant="outline" className="min-h-11 gap-2" onClick={() => ouvrirEdition(null)}>
              <Plus className="size-4" aria-hidden="true" />
              Insérer une ligne
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!table && <Vide message="Sélectionne une table pour parcourir ses lignes." />}
          {lignesErreur && table && (
            <Erreur message={lignesErreur} onReessayer={() => void chargerLignes(table, page, tri)} />
          )}
          {erreurAction && <Erreur message={erreurAction} />}
          {table && lignesChargement && !lignes && <Chargement lignes={5} />}
          {lignes && lignes.data.length === 0 && <Vide message="Table vide." />}
          {lignes && lignes.data.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {colonnes.map(colonne => (
                      <TableHead key={colonne.name}>
                        <Button
                          variant="ghost"
                          className="min-h-11 gap-1 px-2 font-mono text-xs"
                          onClick={() => trierPar(colonne.name)}
                          aria-label={`Trier par ${colonne.name}`}
                        >
                          {colonne.isPrimaryKey && <KeyRound className="size-3" aria-label="clé primaire" />}
                          {colonne.name}
                          {tri?.colonne === colonne.name &&
                            (tri.ordre === "asc" ? (
                              <ArrowUp className="size-3" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="size-3" aria-hidden="true" />
                            ))}
                        </Button>
                      </TableHead>
                    ))}
                    {modifiable && aCle && (
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.data.map((ligne, index) => {
                    const pk = clePrimaire(colonnes, ligne);
                    const cle = pk ? JSON.stringify(pk) : String(index);
                    return (
                      <TableRow key={cle}>
                        {colonnes.map(colonne => (
                          <TableCell
                            key={colonne.name}
                            className="max-w-xs truncate font-mono text-xs"
                            title={apercuCellule(ligne[colonne.name])}
                          >
                            {apercuCellule(ligne[colonne.name])}
                          </TableCell>
                        ))}
                        {modifiable && aCle && (
                          <TableCell className="whitespace-nowrap text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-11"
                              onClick={() => ouvrirEdition(ligne)}
                              aria-label={`Modifier la ligne ${cle}`}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-11 text-destructive"
                              disabled={suppression === cle}
                              onClick={() => void supprimer(ligne)}
                              aria-label={`Supprimer la ligne ${cle}`}
                            >
                              {suppression === cle ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                              ) : (
                                <Trash2 className="size-4" aria-hidden="true" />
                              )}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          {lignes && totalPages > 1 && (
            <nav className="flex items-center justify-end gap-2" aria-label="Pagination des lignes">
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                disabled={page <= 1 || lignesChargement}
                onClick={() => changerPage(page - 1)}
                aria-label="Page précédente"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-11"
                disabled={page >= totalPages || lignesChargement}
                onClick={() => changerPage(page + 1)}
                aria-label="Page suivante"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </nav>
          )}
        </CardContent>
      </Card>

      <Dialog open={edition !== null} onOpenChange={ouvert => !ouvert && setEdition(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <form onSubmit={event => void enregistrer(event)} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{edition?.nouvelle ? `Insérer dans ${table}` : `Modifier une ligne de ${table}`}</DialogTitle>
              <DialogDescription>
                {edition?.nouvelle
                  ? "Les champs vides sont laissés à la valeur par défaut de la base."
                  : "Seules les colonnes modifiées sont envoyées. La clé primaire n'est pas éditable."}
              </DialogDescription>
            </DialogHeader>
            {edition &&
              colonnes
                .filter(colonne => colonne.name in edition.courante)
                .map(colonne => {
                  const genre = genreColonne(colonne.dataType);
                  const id = `db-champ-${colonne.name}`;
                  const verrouille = !edition.nouvelle && colonne.isPrimaryKey;
                  const valeur = edition.courante[colonne.name] ?? "";
                  const changer = (suivante: string) =>
                    setEdition(courante =>
                      courante ? { ...courante, courante: { ...courante.courante, [colonne.name]: suivante } } : null,
                    );
                  return (
                    <div key={colonne.name} className="space-y-1">
                      <Label htmlFor={id} className="font-mono text-xs">
                        {colonne.name}{" "}
                        <span className="text-muted-foreground">
                          ({colonne.dataType}
                          {colonne.nullable ? ", nullable" : ""})
                        </span>
                      </Label>
                      {genre === "json" ? (
                        <Textarea
                          id={id}
                          value={valeur}
                          disabled={verrouille}
                          onChange={event => changer(event.target.value)}
                          className="font-mono text-xs"
                        />
                      ) : genre === "boolean" ? (
                        <select
                          id={id}
                          value={valeur}
                          disabled={verrouille}
                          onChange={event => changer(event.target.value)}
                          className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {edition.nouvelle && <option value="">Par défaut</option>}
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <Input
                          id={id}
                          value={valeur}
                          disabled={verrouille}
                          inputMode={genre === "number" ? "decimal" : undefined}
                          onChange={event => changer(event.target.value)}
                          className="min-h-11 font-mono text-xs"
                        />
                      )}
                    </div>
                  );
                })}
            {erreurEdition && <Erreur message={erreurEdition} />}
            <DialogFooter>
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => setEdition(null)}>
                Annuler
              </Button>
              <Button type="submit" className="min-h-11 gap-2" disabled={enregistrement}>
                {enregistrement && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConsoleSql() {
  const client = useClientAchillea();
  const [requete, setRequete] = useState("SELECT * FROM ");
  const [execution, setExecution] = useState(false);
  const [resultat, setResultat] = useState<DbQueryResult | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const executer = async (event: FormEvent) => {
    event.preventDefault();
    if (!requete.trim()) return;
    setExecution(true);
    setErreur(null);
    try {
      const reponse = await client.admin.dbQuery(requete);
      if (reponse.ok) setResultat(reponse.value);
      else {
        setResultat(null);
        setErreur(messageEchec("admin/db/query", reponse));
      }
    } finally {
      setExecution(false);
    }
  };

  const colonnes = resultat?.data[0] ? Object.keys(resultat.data[0]) : [];

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm">Console SQL (lecture seule)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Une seule instruction SELECT ou WITH, exécutée dans une transaction en lecture seule avec délai et nombre de
          lignes limités. Chaque requête est journalisée.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={event => void executer(event)} className="space-y-3">
          <Label htmlFor="db-console-sql">Requête</Label>
          <Textarea
            id="db-console-sql"
            value={requete}
            onChange={event => setRequete(event.target.value)}
            rows={6}
            spellCheck={false}
            className="font-mono text-xs"
          />
          <Button type="submit" className="min-h-11 gap-2" disabled={execution || !requete.trim()}>
            {execution ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="size-4" aria-hidden="true" />
            )}
            Exécuter
          </Button>
        </form>
        {erreur && <Erreur message={erreur} />}
        {resultat && (
          <div className="space-y-2">
            <output className="block text-xs text-muted-foreground">
              {resultat.rowCount} ligne{resultat.rowCount > 1 ? "s" : ""} · {resultat.durationMs} ms
            </output>
            {resultat.data.length === 0 ? (
              <Vide message="Aucune ligne." />
            ) : (
              <GrilleResultats colonnes={colonnes} lignes={resultat.data} />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** « Base de données » — tables Achilléa (lecture et édition), console SQL en lecture seule et sauvegardes (SuperAdmin). */
export function DatabaseTab() {
  const [mode, setMode] = useState<"tables" | "sql" | "sauvegardes">("tables");
  return (
    <div className="space-y-4">
      <fieldset className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0" aria-label="Mode de l'onglet base de données">
        <Database className="size-5 text-muted-foreground" aria-hidden="true" />
        <Button
          variant={mode === "tables" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setMode("tables")}
          aria-pressed={mode === "tables"}
        >
          Tables
        </Button>
        <Button
          variant={mode === "sql" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setMode("sql")}
          aria-pressed={mode === "sql"}
        >
          Console SQL
        </Button>
        <Button
          variant={mode === "sauvegardes" ? "default" : "outline"}
          className="min-h-11"
          onClick={() => setMode("sauvegardes")}
          aria-pressed={mode === "sauvegardes"}
        >
          Sauvegardes
        </Button>
      </fieldset>
      {mode === "tables" && <NavigateurTables />}
      {mode === "sql" && <ConsoleSql />}
      {mode === "sauvegardes" && <SauvegardesBase />}
    </div>
  );
}
