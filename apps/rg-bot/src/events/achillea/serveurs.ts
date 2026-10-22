/**
 * Arrivée et départ du bot Achilléa sur un serveur → relevé des guildes.
 *
 * L'ancien bot (`events/guildCreate.ts`, `guildDelete.ts`) écrivait lui-même la
 * guilde en base. Ici, une seule autorité écrit l'état multi-serveurs : la
 * tâche cron `achillea:guildes` (`packages/rg-cron/src/tasks/achillea-guildes.ts`),
 * qui relève serveurs, rôles et salons et marque les serveurs quittés. On la
 * déclenche simplement plus tôt que sa planification de 6 h.
 *
 * Plusieurs évènements rapprochés (invitation sur trois serveurs d'affilée)
 * sont fusionnés en UN relevé, 30 s après le dernier : la tâche relit tout, la
 * lancer trois fois ne relèverait rien de plus. Le bail en base
 * (`cron_task_leases`) empêche de toute façon deux relevés simultanés.
 */
import { Discord, On, type ArgsOf } from "discordx";

/** Délai de regroupement des évènements avant le relevé. */
export const DELAI_RELEVE_MS = 30_000;

export type Declencheur = () => Promise<{ success: boolean; error?: string }>;

const declencheurParDefaut: Declencheur = async () => {
  const { lancerTache } = await import("@rosegriffon/cron");
  const resultat = await lancerTache("achillea:guildes", { origine: "pont" });
  return { success: resultat.success, error: resultat.error };
};

/**
 * Planificateur de relevé, isolé pour les tests (délai et déclencheur injectables).
 */
export class PlanificateurReleve {
  private minuteur: ReturnType<typeof setTimeout> | null = null;
  private raisons: string[] = [];

  constructor(
    private readonly declencher: Declencheur = declencheurParDefaut,
    private readonly delaiMs = DELAI_RELEVE_MS,
  ) {}

  /** Demande un relevé ; les demandes rapprochées n'en font qu'un. */
  demander(raison: string): void {
    this.raisons.push(raison);
    if (this.minuteur) clearTimeout(this.minuteur);
    this.minuteur = setTimeout(() => void this.executer(), this.delaiMs);
    // Ne retient jamais l'arrêt du processus.
    (this.minuteur as { unref?: () => void }).unref?.();
  }

  /** Vrai si un relevé est programmé. */
  get enAttente(): boolean {
    return this.minuteur !== null;
  }

  async executer(): Promise<void> {
    if (this.minuteur) clearTimeout(this.minuteur);
    this.minuteur = null;
    const raisons = this.raisons.splice(0);
    try {
      const resultat = await this.declencher();
      if (resultat.success) console.log(`[achillea] relevé des guildes effectué (${raisons.join(", ")})`);
      else console.warn(`[achillea] relevé des guildes en échec : ${resultat.error ?? "raison inconnue"}`);
    } catch (err) {
      console.error("[achillea] relevé des guildes :", err instanceof Error ? err.message : err);
    }
  }

  annuler(): void {
    if (this.minuteur) clearTimeout(this.minuteur);
    this.minuteur = null;
    this.raisons = [];
  }
}

export const planificateurReleve = new PlanificateurReleve();

@Discord()
export class EvenementsServeursAchillea {
  @On({ event: "guildCreate" })
  arrivee([guilde]: ArgsOf<"guildCreate">): void {
    console.log(`[achillea] bot ajouté au serveur ${guilde.name} (${guilde.id})`);
    planificateurReleve.demander(`arrivée sur ${guilde.id}`);
  }

  @On({ event: "guildDelete" })
  depart([guilde]: ArgsOf<"guildDelete">): void {
    console.log(`[achillea] bot retiré du serveur ${guilde.id}`);
    planificateurReleve.demander(`départ de ${guilde.id}`);
  }
}
