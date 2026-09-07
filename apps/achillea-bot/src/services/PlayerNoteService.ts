import type { FilterQuery } from "@mikro-orm/core";
import { rel } from "@mikro-orm/core";
import { BadRequest, NotFound, Unauthorized } from "@tsed/exceptions";

import { Service } from "@/decorators";
import { PlayerNote, Tournament, User } from "@/entities";
import { PlayerNoteCategory, PlayerNoteSeverity, UserRole } from "@/utils/enums";

import { Database } from "./Database";
import { PlayerNoteDocsSync } from "./PlayerNoteDocsSync";

export interface PlayerNoteFilters {
	targetId?: string;
	tournamentId?: number;
	category?: PlayerNoteCategory;
	severity?: PlayerNoteSeverity;
	/** `true` = seulement les traitées, `false` = seulement les ouvertes. */
	resolved?: boolean;
	/** Recherche plein texte simple sur le contenu. */
	search?: string;
	page: number;
	pageSize: number;
}

export interface CreatePlayerNoteInput {
	targetId: string;
	authorId: string;
	tournamentId?: number | null;
	category?: PlayerNoteCategory;
	severity?: PlayerNoteSeverity;
	content: string;
}

const MAX_CONTENT = 2000;

/**
 * Notes du staff sur les joueurs.
 *
 * Deux publics, une seule table : les organisateurs écrivent pendant leur tournoi, le
 * staff relit tout. Les règles d'accès vivent ici plutôt que dans le contrôleur, pour
 * qu'une future commande Discord ou un job ne puisse pas les contourner.
 */
@Service()
export class PlayerNoteService {
	constructor(
		private db: Database,
		private docsSync: PlayerNoteDocsSync
	) {}

	/** Staff = modérateur ou au-dessus. */
	private async isStaff(userId: string): Promise<boolean> {
		const actor = await this.db.em.findOne(User, { id: userId });
		return (actor?.role ?? 0) >= UserRole.Moderator;
	}

	/**
	 * Autorise l'accès aux notes, et dit à quel titre.
	 *
	 * Le staff voit tout. Un organisateur n'accède qu'au périmètre d'un tournoi qu'il
	 * organise : sans tournoi de rattachement, la demande relève du staff seul, sinon
	 * n'importe quel TO se constituerait l'historique complet d'un joueur.
	 *
	 * Lève un 401 si ni l'un ni l'autre.
	 */
	async assertCanAccess(
		userId: string,
		tournamentId?: number | null
	): Promise<{ isStaff: boolean }> {
		if (await this.isStaff(userId)) return { isStaff: true };

		if (tournamentId) {
			// Import différé : `TournamentsService` est chargé par `services/index.ts`,
			// qui repasse par `@/utils/functions` — l'injecter ici casserait le boot.
			const { TournamentsService } = await import("./TournamentsService");
			const { resolveDependency } = await import("@/utils/functions");
			const tournaments = await resolveDependency(TournamentsService);
			// Lève un 401 si l'utilisateur n'organise pas ce tournoi.
			await tournaments.isTournamentOrganizer(userId, tournamentId);
			return { isStaff: false };
		}

		throw new Unauthorized("Réservé au staff et aux organisateurs du tournoi concerné.");
	}

	async create(input: CreatePlayerNoteInput): Promise<PlayerNote> {
		const content = (input.content ?? "").trim();
		if (content.length < 3) throw new BadRequest("La note doit contenir au moins 3 caractères.");

		const target = await this.db.em.findOne(User, { id: input.targetId });
		if (!target) throw new NotFound("Joueur introuvable.");

		if (input.tournamentId) {
			const tournament = await this.db.em.findOne(Tournament, { id: input.tournamentId });
			if (!tournament) throw new NotFound("Tournoi introuvable.");
		}

		const note = new PlayerNote();
		note.target = rel(User, input.targetId);
		note.author = rel(User, input.authorId);
		note.tournament = input.tournamentId ? rel(Tournament, input.tournamentId) : null;
		note.category = input.category ?? PlayerNoteCategory.OTHER;
		note.severity = input.severity ?? PlayerNoteSeverity.INFO;
		note.content = content.slice(0, MAX_CONTENT);

		await this.db.em.persist(note).flush();

		// Miroir Drive : le staff qui travaille dans le dossier Achilléa voit passer le
		// signalement sans ouvrir le dashboard. Jamais bloquant.
		await this.db.em.populate(note, ["target", "author", "tournament"]);
		note.docsUrl = await this.docsSync.appendNote(note);

		return note;
	}

	async list(filters: PlayerNoteFilters): Promise<{ items: PlayerNote[]; total: number }> {
		const where: FilterQuery<PlayerNote> = {};

		if (filters.targetId) where.target = filters.targetId;
		if (filters.tournamentId) where.tournament = filters.tournamentId;
		if (filters.category) where.category = filters.category;
		if (filters.severity) where.severity = filters.severity;
		if (filters.resolved !== undefined) where.resolved = filters.resolved;
		if (filters.search?.trim()) {
			where.content = { $ilike: `%${filters.search.trim()}%` };
		}

		const [items, total] = await this.db.em.findAndCount(PlayerNote, where, {
			populate: ["target", "author", "tournament", "resolvedBy"],
			orderBy: { createdAt: "DESC" },
			limit: filters.pageSize,
			offset: (filters.page - 1) * filters.pageSize,
		});

		return { items, total };
	}

	async update(
		noteId: string,
		actorId: string,
		patch: { content?: string; category?: PlayerNoteCategory; severity?: PlayerNoteSeverity }
	): Promise<PlayerNote> {
		const note = await this.findOrFail(noteId);

		// Modifier le texte d'autrui réécrirait son témoignage : réservé à l'auteur et
		// aux administrateurs (qui, eux, doivent pouvoir corriger un dérapage).
		const actor = await this.db.em.findOne(User, { id: actorId });
		const isAdmin = (actor?.role ?? 0) >= UserRole.Administrator;
		if (note.author?.id !== actorId && !isAdmin) {
			throw new Unauthorized("Seul l'auteur de la note ou un administrateur peut la modifier.");
		}

		if (patch.content !== undefined) {
			const content = patch.content.trim();
			if (content.length < 3) throw new BadRequest("La note doit contenir au moins 3 caractères.");
			note.content = content.slice(0, MAX_CONTENT);
		}
		if (patch.category) note.category = patch.category;
		if (patch.severity) note.severity = patch.severity;

		await this.db.em.flush();

		return note;
	}

	/** Marque traitée / rouvre. Ouvert à tout le staff : c'est un état d'équipe. */
	async setResolved(noteId: string, actorId: string, resolved: boolean): Promise<PlayerNote> {
		const note = await this.findOrFail(noteId);

		note.resolved = resolved;
		note.resolvedAt = resolved ? new Date() : null;
		note.resolvedBy = resolved ? rel(User, actorId) : null;

		await this.db.em.flush();

		await this.db.em.populate(note, ["target", "resolvedBy"]);
		await this.docsSync.appendResolution(note, resolved);

		return note;
	}

	async remove(noteId: string, actorId: string): Promise<void> {
		const note = await this.findOrFail(noteId);

		const actor = await this.db.em.findOne(User, { id: actorId });
		const isAdmin = (actor?.role ?? 0) >= UserRole.Administrator;
		if (note.author?.id !== actorId && !isAdmin) {
			throw new Unauthorized("Seul l'auteur de la note ou un administrateur peut la supprimer.");
		}

		await this.db.em.remove(note).flush();
	}

	/** Compteurs par joueur — pastille « 3 notes dont 1 grave » sur une fiche. */
	async summaryForUser(userId: string): Promise<{
		total: number;
		open: number;
		bySeverity: Record<PlayerNoteSeverity, number>;
	}> {
		const notes = await this.db.em.find(PlayerNote, { target: userId });

		const bySeverity = {
			[PlayerNoteSeverity.INFO]: 0,
			[PlayerNoteSeverity.WARNING]: 0,
			[PlayerNoteSeverity.SERIOUS]: 0,
		};
		let open = 0;

		for (const note of notes) {
			bySeverity[note.severity] = (bySeverity[note.severity] ?? 0) + 1;
			if (!note.resolved) open++;
		}

		return { total: notes.length, open, bySeverity };
	}

	private async findOrFail(noteId: string): Promise<PlayerNote> {
		const note = await this.db.em.findOne(
			PlayerNote,
			{ id: noteId },
			{ populate: ["target", "author", "tournament", "resolvedBy"], refresh: true }
		);
		if (!note) throw new NotFound("Note introuvable.");

		return note;
	}

	/** Forme sérialisable pour l'API (aucune donnée technique inutile côté client). */
	toDTO(note: PlayerNote) {
		const person = (user: User | null | undefined) =>
			user
				? {
						id: user.id,
						username: user.username,
						displayName: user.displayName,
						avatar: user.avatar,
					}
				: null;

		return {
			id: note.id,
			target: person(note.target),
			author: person(note.author),
			tournament: note.tournament ? { id: note.tournament.id, name: note.tournament.name } : null,
			category: note.category,
			severity: note.severity,
			content: note.content,
			resolved: note.resolved,
			resolvedAt: note.resolvedAt ?? null,
			resolvedBy: person(note.resolvedBy),
			createdAt: note.createdAt,
			updatedAt: note.updatedAt,
			docsUrl: note.docsUrl ?? null,
		};
	}
}
