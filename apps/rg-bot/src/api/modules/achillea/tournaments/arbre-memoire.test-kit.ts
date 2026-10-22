/**
 * Stockage brackets-manager en mémoire pour les tests de progression : même
 * contrat `CrudInterface` que `KyselyBracketAdapter`, sans Postgres. Les lignes
 * sont copiées à l'écriture et à la lecture, comme une vraie base.
 */
import type { CrudInterface, DataTypes, OmitId, Table } from "brackets-manager";
import { BracketsManager } from "brackets-manager";
import type { Id } from "brackets-model";

export class ArbreMemoire implements CrudInterface {
  private readonly tables = new Map<string, Array<Record<string, unknown>>>();
  private prochainId = 1;

  private lignes(table: Table) {
    let lignes = this.tables.get(String(table));
    if (!lignes) {
      lignes = [];
      this.tables.set(String(table), lignes);
    }
    return lignes;
  }

  private static correspond(ligne: Record<string, unknown>, filtre: Record<string, unknown>) {
    return Object.entries(filtre).every(([cle, valeur]) => valeur === undefined || ligne[cle] === valeur);
  }

  async insert<T extends Table>(table: T, valeur: OmitId<DataTypes[T]> | OmitId<DataTypes[T]>[]): Promise<any> {
    const liste = Array.isArray(valeur);
    const ids: number[] = [];
    for (const entree of (liste ? valeur : [valeur]) as Array<Record<string, unknown>>) {
      const id = this.prochainId++;
      this.lignes(table).push(structuredClone({ ...entree, id }));
      ids.push(id);
    }
    return liste ? true : ids[0];
  }

  async select<T extends Table>(table: T, filtre?: Id | Partial<DataTypes[T]>): Promise<any> {
    const lignes = this.lignes(table);
    if (filtre === undefined) return structuredClone(lignes);
    if (typeof filtre === "object") {
      return structuredClone(lignes.filter(l => ArbreMemoire.correspond(l, filtre as Record<string, unknown>)));
    }
    return structuredClone(lignes.find(l => l.id === filtre) ?? null);
  }

  async update<T extends Table>(
    table: T,
    filtre: Id | Partial<DataTypes[T]>,
    valeur?: Partial<DataTypes[T]>,
  ): Promise<boolean> {
    if (!valeur) return false;
    const cibles =
      typeof filtre === "object"
        ? this.lignes(table).filter(l => ArbreMemoire.correspond(l, filtre as Record<string, unknown>))
        : this.lignes(table).filter(l => l.id === filtre);
    for (const cible of cibles) Object.assign(cible, structuredClone(valeur));
    return cibles.length > 0;
  }

  async delete<T extends Table>(table: T, filtre?: Partial<DataTypes[T]>): Promise<boolean> {
    const restantes = this.lignes(table).filter(
      l => filtre !== undefined && !ArbreMemoire.correspond(l, filtre as Record<string, unknown>),
    );
    this.tables.set(String(table), restantes);
    return true;
  }
}

/** Arbre à élimination simple de `noms.length` joueurs dans une table de `taille` places. */
export async function creerArbreSimple(noms: string[], taille: number, tournoiId = 1) {
  const manager = new BracketsManager(new ArbreMemoire());
  const stage = await manager.create.stage({
    tournamentId: tournoiId,
    name: "Test",
    type: "single_elimination",
    seeding: noms,
    settings: { size: taille, seedOrdering: ["inner_outer"], consolationFinal: false },
  });
  await manager.update.confirmSeeding(stage.id);
  const participants = (await manager.storage.select("participant")) ?? [];
  const nomParId = new Map(participants.map(p => [Number(p.id), p.name]));
  return { manager, stageId: Number(stage.id), tournoiId, nomParId };
}
