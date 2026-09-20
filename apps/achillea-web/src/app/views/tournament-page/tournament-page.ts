import {
	ChangeDetectorRef,
	Component,
	computed,
	effect,
	ElementRef,
	NgZone,
	OnDestroy,
	OnInit,
	signal,
	inject,
	viewChild,
} from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { TournamentsService } from "../../shared/services/tournaments-service";
import {
	MatchFormat,
	ParticipantDTO,
	ParticipantStatus,
	SCORE_REPORT_POLICY_OPTIONS,
	ScoreReportPolicy,
	Tournament,
	TournamentEventDTO,
	TournamentEventType,
	TournamentState,
	TournamentSummary,
	stageTypeToString,
} from "../../core/models/Tournament";
import { ProgressSpinner } from "primeng/progressspinner";
import { Button } from "primeng/button";
import { UserService } from "../../shared/services/user-service";
import { isTournamentOrganizerUser } from "../../core/helpers/tournament-organizer";
import { DatePipe } from "@angular/common";
import { MessageService } from "primeng/api";
import { Dialog } from "primeng/dialog";
import { InputText } from "primeng/inputtext";
import { Tag } from "primeng/tag";
import { ProgressBar } from "primeng/progressbar";
import { Tooltip } from "primeng/tooltip";
import { Tabs, TabList, Tab, TabPanels, TabPanel } from "primeng/tabs";
import { EventParticipantsTable } from "../../shared/components/event-participants-table/event-participants-table";
import { EventOrganizersManager } from "../../shared/components/event-organizers-manager/event-organizers-manager";
import { TournamentCreationForm } from "../../shared/components/tournament-creation-form/tournament-creation-form.component";
import { AuthPage } from "../auth-page/auth-page";
import { ScoresDialog } from "../../shared/components/scores-dialog/scores-dialog";
import { UserAvatar } from "../../shared/components/user-avatar/user-avatar";
import { PlayerNotesPanel } from "../../shared/components/player-notes-panel/player-notes-panel";
import { getEloImagePath } from "../../core/helpers/misc";

declare const bracketsViewer: any;

type PhaseStep = {
	key: TournamentState;
	label: string;
	icon: string;
};

const PHASE_STEPS: PhaseStep[] = [
	{ key: TournamentState.PENDING, label: "Planification", icon: "pi-file-edit" },
	{ key: TournamentState.PREREGISTERING, label: "Inscriptions", icon: "pi-user-plus" },
	{ key: TournamentState.PREPARING, label: "Préparation", icon: "pi-sitemap" },
	{ key: TournamentState.ONGOING, label: "En cours", icon: "pi-play" },
	{ key: TournamentState.FINISHED, label: "Terminé", icon: "pi-flag" },
];

@Component({
	selector: "app-tournament-page",
	imports: [
		ProgressSpinner,
		Button,
		DatePipe,
		Dialog,
		InputText,
		Tag,
		ProgressBar,
		Tooltip,
		Tabs,
		TabList,
		Tab,
		TabPanels,
		TabPanel,
		RouterLink,
		EventParticipantsTable,
		EventOrganizersManager,
		TournamentCreationForm,
		AuthPage,
		ScoresDialog,
		UserAvatar,
		PlayerNotesPanel,
	],
	templateUrl: "./tournament-page.html",
	styleUrl: "./tournament-page.css",
})
export class TournamentPage implements OnInit, OnDestroy {
	private tService = inject(TournamentsService);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	protected userService = inject(UserService);
	private msgService = inject(MessageService);
	private cdr = inject(ChangeDetectorRef);
	private zone = inject(NgZone);

	protected tournament: Tournament | null = null;
	protected participants: ParticipantDTO[] = [];
	protected tournamentData: any;
	protected tournamentId: number | null = null;
	protected isParticipant = false;
	protected isTournamentOrganizer = false;

	protected showMatchScoresDialog = signal(0);
	protected showTOsDialog = signal(false);
	protected showEditDialog = signal(false);
	/** Dialogue de clôture / annulation / restauration (une seule fenêtre, trois modes). */
	protected lifecycleAction = signal<"close" | "cancel" | "restore" | null>(null);
	protected cancelReason = signal("");
	protected forceClose = signal(false);
	/** Journal du tournoi — chargé à l'ouverture de son onglet. */
	protected events = signal<TournamentEventDTO[]>([]);
	protected eventsLoading = signal(false);
	protected canGenerateBrackets = signal(false);
	protected canStartTournament = signal(false);
	protected canStartPreregistration = signal(false);
	protected actionLoading = signal(false);
	protected logoBroken = signal(false);
	protected coverBroken = signal(false);
	protected pageLoading = signal(true);
	protected activeTab = signal("0");
	protected nowTick = signal(Date.now());
	protected linkCopied = signal(false);
	/** Top 10 + stats matchs — public, chargé en parallèle sans bloquer le rendu principal. */
	protected summary = signal<TournamentSummary | null>(null);

	/** Qui saisit les scores — miroir du tournoi chargé (champ simple, non réactif). */
	protected scoreReportPolicy = signal<ScoreReportPolicy>(ScoreReportPolicy.PLAYERS);
	protected policyLoading = signal(false);

	// ── Barre de défilement horizontale du bracket ────────────────────────────
	// Le tableau dépasse en largeur ET en hauteur : la barre native du conteneur se
	// trouve tout en bas, hors écran. Une barre miroir collée au bas de la fenêtre
	// (position: sticky) reste à portée de souris quelle que soit la position.
	private readonly bracketPaneRef = viewChild<ElementRef<HTMLElement>>("bracketScroll");
	private readonly bracketBarRef = viewChild<ElementRef<HTMLElement>>("bracketBar");
	protected bracketScrollWidth = signal(0);
	private bracketVisibleWidth = signal(0);
	protected bracketOverflows = computed(
		() => this.bracketScrollWidth() > this.bracketVisibleWidth() + 1
	);

	private tickTimer: ReturnType<typeof setInterval> | null = null;
	private routeSub: { unsubscribe: () => void } | null = null;

	constructor() {
		// Le bracket vit dans un onglet : ses éléments apparaissent et disparaissent.
		// L'effet se rejoue à chaque (dé)montage et nettoie ses propres écouteurs.
		effect((onCleanup) => {
			const pane = this.bracketPaneRef()?.nativeElement;
			const bar = this.bracketBarRef()?.nativeElement;
			if (!pane || !bar || typeof window === "undefined") return;

			// Défilement à 60 Hz : hors zone Angular, sinon chaque frame déclenche
			// une détection de changements sur toute la page.
			const onPaneScroll = () => {
				if (bar.scrollLeft !== pane.scrollLeft) bar.scrollLeft = pane.scrollLeft;
			};
			const onBarScroll = () => {
				if (pane.scrollLeft !== bar.scrollLeft) pane.scrollLeft = bar.scrollLeft;
			};
			const measure = () => this.measureBracketScroll();

			this.zone.runOutsideAngular(() => {
				pane.addEventListener("scroll", onPaneScroll, { passive: true });
				bar.addEventListener("scroll", onBarScroll, { passive: true });
				window.addEventListener("resize", measure);
			});

			// Le viewer est injecté par une librairie externe : sa largeur ne bouge pas
			// au rythme d'Angular (rendu asynchrone, images d'avatars qui arrivent après).
			const observer =
				typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure());
			observer?.observe(pane);
			const viewer = pane.querySelector("#brackets-viewer");
			if (viewer) observer?.observe(viewer);

			measure();

			onCleanup(() => {
				pane.removeEventListener("scroll", onPaneScroll);
				bar.removeEventListener("scroll", onBarScroll);
				window.removeEventListener("resize", measure);
				observer?.disconnect();
			});
		});
	}

	/** Recale la largeur de la barre miroir sur le contenu réel du bracket. */
	private measureBracketScroll() {
		const pane = this.bracketPaneRef()?.nativeElement;
		const bar = this.bracketBarRef()?.nativeElement;
		if (!pane) return;

		this.bracketScrollWidth.set(pane.scrollWidth);
		this.bracketVisibleWidth.set(pane.clientWidth);
		if (bar && bar.scrollLeft !== pane.scrollLeft) bar.scrollLeft = pane.scrollLeft;
	}

	protected get fillPercent(): number {
		const t = this.tournament;
		if (!t?.participantsNumber) return 0;
		return Math.min(100, Math.round((this.activeParticipants.length / t.participantsNumber) * 100));
	}

	protected get canEditTournament(): boolean {
		if (!this.tournament || !this.isTournamentOrganizer) return false;
		return (
			this.tournament.internalState !== TournamentState.FINISHED &&
			this.tournament.internalState !== TournamentState.CANCELED
		);
	}

	protected get isRegistrationOpen(): boolean {
		const s = this.tournament?.internalState;
		return s === TournamentState.PREREGISTERING || s === TournamentState.PREPARING;
	}

	/** Seuls les inscrits actifs occupent une place (ni liste d'attente ni disqualifiés). */
	protected get activeParticipants(): ParticipantDTO[] {
		return this.participants.filter(
			(p) => (p.status ?? ParticipantStatus.ACTIVE) === ParticipantStatus.ACTIVE
		);
	}

	protected get waitlist(): ParticipantDTO[] {
		return this.participants
			.filter((p) => p.status === ParticipantStatus.WAITLISTED)
			.sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
	}

	/** Position du joueur connecté dans la liste d'attente, s'il y est. */
	protected get myWaitlistPosition(): number | null {
		const uid = this.userService.user()?.id;
		if (!uid) return null;
		const mine = this.participants.find(
			(p) => p.user.id === uid && p.status === ParticipantStatus.WAITLISTED
		);
		return mine?.waitlistPosition ?? null;
	}

	protected get isDisqualified(): boolean {
		const uid = this.userService.user()?.id;
		if (!uid) return false;
		return this.participants.some(
			(p) => p.user.id === uid && p.status === ParticipantStatus.DISQUALIFIED
		);
	}

	protected get isFull(): boolean {
		const capacity = this.tournament?.participantsNumber;
		if (!capacity) return false;
		return this.activeParticipants.length >= capacity;
	}

	/** Nombre de places affiché dans l'onglet des participants. */
	protected get remainingPlaces(): number {
		return (this.tournament?.participantsNumber ?? 0) - this.participants.length;
	}

	/** Clôture manuelle : réservée à un tournoi effectivement en cours. */
	protected get canCloseTournament(): boolean {
		return this.isTournamentOrganizer && this.tournament?.internalState === TournamentState.ONGOING;
	}

	/** Annulation : tout sauf un tournoi déjà terminé ou déjà annulé. */
	protected get canCancelTournament(): boolean {
		const s = this.tournament?.internalState;
		return (
			this.isTournamentOrganizer &&
			s !== undefined &&
			s !== TournamentState.FINISHED &&
			s !== TournamentState.CANCELED
		);
	}

	protected get canRestoreTournament(): boolean {
		return (
			this.isTournamentOrganizer && this.tournament?.internalState === TournamentState.CANCELED
		);
	}

	protected get sortedParticipants(): ParticipantDTO[] {
		return [...this.participants].sort((a, b) => {
			const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
			const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
			if (sa !== sb) return sa - sb;
			return this.participantName(a).localeCompare(this.participantName(b));
		});
	}

	protected get phaseSteps(): PhaseStep[] {
		return PHASE_STEPS;
	}

	protected get coverUrl(): string | null {
		if (!this.tournament) return null;
		const url = this.tournament.affiche || this.tournament.logo;
		return url?.trim() ? url : null;
	}

	protected get logoUrl(): string | null {
		if (!this.tournament) return null;
		const url = this.tournament.logo || this.tournament.affiche;
		return url?.trim() ? url : null;
	}

	ngOnInit() {
		const userPromise = this.userService.loadUserIfNeeded();
		this.routeSub = this.route.paramMap.subscribe(async (params) => {
			this.pageLoading.set(true);
			this.tournamentId = Number.parseInt(params.get("id") ?? "0");

			if (this.tournamentId == null || this.tournamentId < 1) {
				await this.router.navigate(["/not-found"]);
				return;
			}

			// Top 10 + stats : indépendant du chargement principal, ne doit jamais le bloquer
			// (tournoi tout juste créé sans bracket -> summary reste vide, pas d'erreur affichée).
			this.summary.set(null);
			void this.tService.getTournamentSummary(this.tournamentId).then((s) => this.summary.set(s));

			await Promise.all([this.loadTournament(this.tournamentId), userPromise]);
			if (this.tournament) {
				this.isTournamentOrganizer = this.isTO(this.tournament);
				this.isParticipant = !!this.participants.find(
					(p) => p.user.id === this.userService.user()?.id
				);
				this.pickDefaultTab();
				this.cdr.detectChanges();
			}
			this.pageLoading.set(false);
		});

		this.tickTimer = setInterval(() => this.nowTick.set(Date.now()), 30_000);
	}

	ngOnDestroy() {
		this.routeSub?.unsubscribe();
		if (this.tickTimer) clearInterval(this.tickTimer);
	}

	protected closeMatchScoresDialog() {
		this.showMatchScoresDialog.set(0);
	}

	protected async loadTournament(tournamentId: number): Promise<void> {
		const res = await this.tService.getTournament(tournamentId);

		if (res === null) {
			await this.router.navigate(["/not-found"]);
			return;
		}

		this.tournament = res[0];
		this.participants = res[1];
		this.tournamentData = res[2];
		this.logoBroken.set(false);
		this.coverBroken.set(false);
		this.isParticipant = !!this.participants.find((p) => p.user.id === this.userService.user()?.id);
		this.isTournamentOrganizer = this.isTO(res[0]);
		this.scoreReportPolicy.set(this.tournament.scoreReportPolicy ?? ScoreReportPolicy.PLAYERS);

		this.canStartPreregistration.set(this.tournament.internalState === TournamentState.PENDING);
		// Génération / re-génération du bracket : inscriptions (fenêtre 30 min) ou préparation.
		this.canGenerateBrackets.set(
			this.isTournamentOrganizer &&
				(this.tournament.internalState === TournamentState.PREPARING ||
					(this.isTournamentWithinThirtyMinutes() &&
						this.tournament.internalState === TournamentState.PREREGISTERING))
		);
		this.canStartTournament.set(
			Date.now() > new Date(this.tournament.startsAt).getTime() &&
				this.tournament.internalState === TournamentState.PREPARING
		);

		if (typeof document !== "undefined" && this.tournament.name) {
			document.title = `${this.tournament.name} — Achilléa`;
		}

		this.cdr.detectChanges();

		if (this.shouldRenderBracket && this.canDisplayBracket) {
			// Laisse le DOM d'onglet se peindre avant d'injecter le viewer
			await new Promise((r) => setTimeout(r, 50));
			await this.renderBracket(res[2]);
		}
	}

	private pickDefaultTab() {
		if (!this.tournament) return;
		const s = this.tournament.internalState;
		if (
			(s === TournamentState.ONGOING ||
				s === TournamentState.FINISHED ||
				s === TournamentState.PREPARING) &&
			this.canDisplayBracket
		) {
			this.activeTab.set("1");
		} else {
			this.activeTab.set("0");
		}
	}

	protected get shouldRenderBracket(): boolean {
		if (!this.tournament) return false;
		const s = this.tournament.internalState;
		if (s === TournamentState.ONGOING || s === TournamentState.FINISHED) return true;
		if (s === TournamentState.PREPARING && this.isTournamentOrganizer) return true;
		return false;
	}

	get canDisplayBracket() {
		const data = this.tournamentData;
		return (
			!!data &&
			Array.isArray(data.stage) &&
			data.stage.length > 0 &&
			Array.isArray(data.match) &&
			data.match.length > 0 &&
			Array.isArray(data.participant) &&
			data.participant.length > 0
		);
	}

	private isTO(tournament: Tournament) {
		return isTournamentOrganizerUser(this.userService.user(), tournament);
	}

	protected isHttpUrl(value: string | null | undefined): boolean {
		if (!value) return false;
		return /^https?:\/\//i.test(value.trim());
	}

	/**
	 * Discord du tournoi d'Evo (Summer Kama Club #32) — serveur Kama Club.
	 * https://discord.gg/gCJNPQEJ
	 */
	protected get discordInviteUrl(): string | null {
		const t = this.tournament;
		if (!t) return null;
		// Tournoi d'Evo uniquement (Summer Kama Club)
		if (t.id === 32 || /kama\s*club/i.test(t.name)) {
			return "https://discord.gg/gCJNPQEJ";
		}
		return null;
	}

	/** Libellé CTA Discord (tournoi Evo / Kama Club). */
	protected get discordInviteLabel(): string {
		return "Rejoindre le serveur Kama Club";
	}

	protected stateLabel(state: TournamentState): string {
		switch (state) {
			case TournamentState.PENDING:
				return "Planification";
			case TournamentState.PREREGISTERING:
				return "Inscriptions ouvertes";
			case TournamentState.PREPARING:
				return "Préparation";
			case TournamentState.ONGOING:
				return "En cours";
			case TournamentState.FINISHED:
				return "Terminé";
			case TournamentState.CANCELED:
				return "Annulé";
			default:
				return String(state);
		}
	}

	protected stateSeverity(
		state: TournamentState
	): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" {
		switch (state) {
			case TournamentState.PENDING:
				return "secondary";
			case TournamentState.PREREGISTERING:
				return "success";
			case TournamentState.PREPARING:
				return "info";
			case TournamentState.ONGOING:
				return "warn";
			case TournamentState.FINISHED:
				return "contrast";
			case TournamentState.CANCELED:
				return "danger";
			default:
				return "secondary";
		}
	}

	protected stateIcon(state: TournamentState): string {
		switch (state) {
			case TournamentState.PENDING:
				return "pi pi-file-edit";
			case TournamentState.PREREGISTERING:
				return "pi pi-user-plus";
			case TournamentState.PREPARING:
				return "pi pi-sitemap";
			case TournamentState.ONGOING:
				return "pi pi-bolt";
			case TournamentState.FINISHED:
				return "pi pi-flag";
			case TournamentState.CANCELED:
				return "pi pi-ban";
			default:
				return "pi pi-info-circle";
		}
	}

	protected formatLabel(format: MatchFormat | string | null | undefined): string {
		switch (format) {
			case MatchFormat.BO1:
			case "bo1":
				return "BO1";
			case MatchFormat.BO3:
			case "bo3":
				return "BO3";
			case MatchFormat.BO5:
			case "bo5":
				return "BO5";
			case MatchFormat.DOUBLE_LEG:
			case "double_leg":
				return "Aller-retour";
			case MatchFormat.CUSTOM:
			case "custom":
				return "Format custom";
			default:
				return format ? String(format) : "—";
		}
	}

	protected typeLabel(type: string | null | undefined): string {
		if (!type) return "—";
		return stageTypeToString(type as any) ?? type.replace(/_/g, " ");
	}

	protected phaseStatus(step: PhaseStep): "done" | "active" | "todo" | "canceled" {
		if (!this.tournament) return "todo";
		const s = this.tournament.internalState;
		if (s === TournamentState.CANCELED) {
			return step.key === TournamentState.PENDING ? "canceled" : "todo";
		}
		const order = PHASE_STEPS.map((p) => p.key);
		const current = order.indexOf(s);
		const idx = order.indexOf(step.key);
		if (current < 0 || idx < 0) return "todo";
		if (idx < current) return "done";
		if (idx === current) return "active";
		return "todo";
	}

	protected countdownLabel(): string | null {
		if (!this.tournament) return null;
		const s = this.tournament.internalState;
		if (s !== TournamentState.PREREGISTERING && s !== TournamentState.PREPARING) return null;
		const start = new Date(this.tournament.startsAt).getTime();
		const diff = start - this.nowTick();
		if (diff <= 0) return "Le tournoi peut démarrer";
		const days = Math.floor(diff / 86_400_000);
		const hours = Math.floor((diff % 86_400_000) / 3_600_000);
		const mins = Math.floor((diff % 3_600_000) / 60_000);
		if (days > 0) return `Dans ${days}j ${hours}h`;
		if (hours > 0) return `Dans ${hours}h ${mins}min`;
		return `Dans ${mins} min`;
	}

	protected statusMessage(): string {
		if (!this.tournament) return "";
		const s = this.tournament.internalState;
		switch (s) {
			case TournamentState.PENDING:
				return "Les inscriptions ne sont pas encore ouvertes.";
			case TournamentState.PREREGISTERING:
				return this.isFull
					? "Complet — une place peut se libérer."
					: "Inscriptions ouvertes — réserve ta place !";
			case TournamentState.PREPARING:
				return "Bracket en préparation, démarrage imminent.";
			case TournamentState.ONGOING:
				// Le détail « clique un match » est déjà dans le bandeau du bracket.
				return "";
			case TournamentState.FINISHED:
				return "Tournoi terminé — bracket et résultats toujours consultables.";
			case TournamentState.CANCELED:
				return "Ce tournoi a été annulé.";
			default:
				return "";
		}
	}

	protected async copyLink() {
		try {
			const url = typeof window !== "undefined" ? window.location.href : "";
			if (!url) return;
			await navigator.clipboard.writeText(url);
			this.linkCopied.set(true);
			this.msgService.add({
				severity: "success",
				summary: "Lien copié",
				detail: "Le lien du tournoi est dans ton presse-papiers.",
				life: 2500,
			});
			setTimeout(() => this.linkCopied.set(false), 2000);
		} catch {
			this.msgService.add({
				severity: "error",
				summary: "Impossible de copier",
				detail: "Copie manuelle depuis la barre d'adresse.",
			});
		}
	}

	protected onTabChange(value: string | number | undefined | null) {
		if (value == null) return;
		this.activeTab.set(String(value));
		if (String(value) === "1" && this.shouldRenderBracket && this.canDisplayBracket) {
			// Re-render après bascule d'onglet (le viewer a besoin d'un conteneur visible)
			void this.renderBracket(this.tournamentData);
		}
		// Le journal n'est chargé qu'à l'ouverture de son onglet : inutile de le tirer
		// à chaque affichage de page alors qu'il n'intéresse qu'une minorité de visites.
		if (String(value) === "4" && this.tournamentId && this.events().length === 0) {
			void this.loadEvents(this.tournamentId);
		}
	}

	protected async register(tournamentId: number) {
		this.actionLoading.set(true);
		try {
			const participant = await this.tService.participate(tournamentId);
			if (participant) {
				this.msgService.add({
					severity: "success",
					summary: "Inscription réussie",
					detail: `Tu es inscrit à ${this.tournament?.name ?? "ce tournoi"}.`,
				});
				await this.loadTournament(tournamentId);
			}
		} finally {
			this.actionLoading.set(false);
		}
	}

	protected async unregister(tournamentId: number) {
		this.actionLoading.set(true);
		try {
			const ok = await this.tService.unregister(tournamentId);
			if (ok) {
				this.msgService.add({
					severity: "success",
					summary: "Désinscription réussie",
					detail: `Tu n'es plus inscrit à ${this.tournament?.name ?? "ce tournoi"}.`,
				});
				await this.loadTournament(tournamentId);
			}
		} finally {
			this.actionLoading.set(false);
		}
	}

	protected async openRegistrations(tournamentId: number) {
		this.actionLoading.set(true);
		try {
			const success = await this.tService.openRegistrations(tournamentId);
			if (success) await this.loadTournament(tournamentId);
		} finally {
			this.actionLoading.set(false);
		}
	}

	/**
	 * Le joueur connecté peut-il saisir le score de ses propres matchs ?
	 * Sert au bandeau du bracket : promettre « saisis les scores » à quelqu'un qui
	 * n'a que la lecture est le meilleur moyen de générer un ticket support.
	 */
	protected get canReportOwnScores(): boolean {
		if (this.isTournamentOrganizer) return true;
		if (this.scoreReportPolicy() === ScoreReportPolicy.STAFF_ONLY) return false;
		return this.isParticipant;
	}

	/** Bascule staff / joueurs depuis l'onglet Organisation (sans rouvrir le formulaire). */
	protected async changeScoreReportPolicy(policy: ScoreReportPolicy) {
		if (this.policyLoading() || this.scoreReportPolicy() === policy) return;
		const id = this.tournament?.id;
		if (!id) return;

		this.policyLoading.set(true);
		const previous = this.scoreReportPolicy();
		this.scoreReportPolicy.set(policy);
		try {
			const success = await this.tService.setScoreReportPolicy(id, policy);
			if (!success) {
				this.scoreReportPolicy.set(previous);
				return;
			}
			if (this.tournament) this.tournament.scoreReportPolicy = policy;
		} finally {
			this.policyLoading.set(false);
		}
	}

	protected async onTournamentSaved(_updated: Tournament | null) {
		this.showEditDialog.set(false);
		if (this.tournamentId) await this.loadTournament(this.tournamentId);
	}

	protected async generateBrackets(tournamentId: number) {
		this.actionLoading.set(true);
		try {
			const success = await this.tService.generateBracket(tournamentId);
			if (success) {
				await this.loadTournament(tournamentId);
				this.activeTab.set("1");
			}
		} finally {
			this.actionLoading.set(false);
		}
	}

	protected async startTournament(tournamentId: number) {
		this.actionLoading.set(true);
		try {
			const success = await this.tService.startTournament(tournamentId);
			if (success) {
				await this.loadTournament(tournamentId);
				this.activeTab.set("1");
			}
		} finally {
			this.actionLoading.set(false);
		}
	}

	// ── Clôture / annulation / restauration ────────────────────────────────────

	protected openLifecycleDialog(action: "close" | "cancel" | "restore") {
		this.cancelReason.set("");
		this.forceClose.set(false);
		this.lifecycleAction.set(action);
	}

	protected closeLifecycleDialog() {
		if (this.actionLoading()) return;
		this.lifecycleAction.set(null);
	}

	protected get lifecycleTitle(): string {
		switch (this.lifecycleAction()) {
			case "close":
				return "Clôturer le tournoi";
			case "cancel":
				return "Annuler le tournoi";
			case "restore":
				return "Restaurer le tournoi";
			default:
				return "";
		}
	}

	/** L'API exige un motif d'annulation d'au moins 3 caractères : même règle ici. */
	protected get canConfirmLifecycle(): boolean {
		if (this.lifecycleAction() === "cancel") return this.cancelReason().trim().length >= 3;
		return true;
	}

	protected onCancelReasonInput(event: Event) {
		this.cancelReason.set((event.target as HTMLInputElement)?.value ?? "");
	}

	protected async confirmLifecycleAction() {
		const action = this.lifecycleAction();
		const id = this.tournament?.id;
		if (!action || !id || this.actionLoading()) return;

		this.actionLoading.set(true);
		try {
			let success = false;

			if (action === "close") {
				const res = await this.tService.closeTournament(id, this.forceClose());
				success = res.success;
				// Refus pour matchs ouverts : on propose le forçage plutôt que de
				// refermer la fenêtre, l'organisateur enchaîne d'un clic.
				if (!success && (res as { openLobbies?: number }).openLobbies) {
					this.forceClose.set(true);
					return;
				}
			} else if (action === "cancel") {
				success = await this.tService.cancelTournament(id, this.cancelReason().trim());
			} else {
				success = await this.tService.restoreTournament(id);
			}

			if (success) {
				this.lifecycleAction.set(null);
				await this.loadTournament(id);
				await this.loadEvents(id);
			}
		} finally {
			this.actionLoading.set(false);
		}
	}

	// ── Journal ────────────────────────────────────────────────────────────────

	protected async loadEvents(tournamentId: number) {
		this.eventsLoading.set(true);
		try {
			this.events.set(await this.tService.getTournamentEvents(tournamentId));
		} finally {
			this.eventsLoading.set(false);
		}
	}

	/** Libellé lisible d'un évènement du journal. */
	protected eventLabel(event: TournamentEventDTO): string {
		const target = event.target?.displayName || event.target?.username || "un joueur";
		const labels: Record<TournamentEventType, string> = {
			created: "Tournoi créé",
			updated: "Tournoi modifié",
			registrations_opened: "Inscriptions ouvertes",
			registrations_closed: "Inscriptions fermées",
			participant_registered: `${target} s'est inscrit`,
			participant_waitlisted: `${target} placé en liste d'attente`,
			participant_promoted: `${target} promu depuis la liste d'attente`,
			participant_unregistered: `${target} s'est désinscrit`,
			participant_removed: `${target} retiré par un organisateur`,
			participant_disqualified: `${target} disqualifié`,
			participant_reinstated: `${target} réintégré`,
			seeding_changed: "Seeding modifié",
			bracket_generated: "Bracket généré",
			tournament_started: "Tournoi démarré",
			score_reported: "Score saisi",
			score_validated: "Score validé",
			phase_advanced: "Phase suivante",
			organizer_added: `${target} ajouté aux organisateurs`,
			organizer_removed: `${target} retiré des organisateurs`,
			tournament_closed: "Tournoi clôturé",
			tournament_canceled: "Tournoi annulé",
			tournament_restored: "Tournoi restauré",
		};

		return labels[event.type] ?? event.type;
	}

	protected eventIcon(event: TournamentEventDTO): string {
		switch (event.type) {
			case "participant_registered":
			case "participant_promoted":
				return "pi pi-user-plus";
			case "participant_unregistered":
			case "participant_removed":
				return "pi pi-user-minus";
			case "participant_waitlisted":
				return "pi pi-hourglass";
			case "participant_disqualified":
				return "pi pi-ban";
			case "participant_reinstated":
				return "pi pi-replay";
			case "score_reported":
			case "score_validated":
				return "pi pi-flag";
			case "seeding_changed":
				return "pi pi-sort-numeric-up";
			case "bracket_generated":
				return "pi pi-sitemap";
			case "tournament_started":
				return "pi pi-play";
			case "tournament_closed":
				return "pi pi-check-circle";
			case "tournament_canceled":
				return "pi pi-times-circle";
			case "tournament_restored":
				return "pi pi-history";
			case "organizer_added":
			case "organizer_removed":
				return "pi pi-shield";
			default:
				return "pi pi-circle-fill";
		}
	}

	/** Détail court affiché sous le libellé (scores, mode de seeding, forçage). */
	protected eventDetail(event: TournamentEventDTO): string | null {
		const payload = event.payload ?? {};

		if (event.type === "score_reported" || event.type === "score_validated") {
			const t1 = payload["scoreTeam1"];
			const t2 = payload["scoreTeam2"];
			const game = payload["gameNumber"];
			if (t1 != null && t2 != null) return `Manche ${game ?? "?"} — ${t1} : ${t2}`;
		}

		if (event.type === "seeding_changed") {
			const mode = String(payload["mode"] ?? "");
			if (mode === "ranked") return "Seeds attribuées selon le classement ranked";
			if (mode === "random") return "Seeds mélangées aléatoirement";
			if (mode === "clear") return "Toutes les seeds retirées";
			if (mode === "manual") return `Seed ${payload["seed"] ?? "—"}`;
		}

		if (event.type === "updated" && payload["scoreReportPolicy"] != null) {
			return payload["scoreReportPolicy"] === ScoreReportPolicy.STAFF_ONLY
				? "Saisie des scores réservée aux organisateurs"
				: "Saisie des scores ouverte aux joueurs";
		}

		if (event.type === "tournament_closed" && payload["forced"] === true) {
			return `Clôture forcée (${payload["openLobbies"] ?? 0} match(s) non terminé(s))`;
		}

		if (event.type === "created" && Array.isArray(payload["bypassedRules"])) {
			return `Règles de publication contournées : ${(payload["bypassedRules"] as string[]).join(", ")}`;
		}

		return event.reason ?? null;
	}

	protected isTournamentWithinThirtyMinutes(): boolean {
		if (!this.tournament?.startsAt) return false;
		const now = Date.now();
		const target = new Date(this.tournament.startsAt).getTime();
		const thirtyMinutesInMs = 30 * 60 * 1000;
		return now >= target - thirtyMinutesInMs && now <= target;
	}

	protected async renderBracket(data: any) {
		if (typeof bracketsViewer === "undefined") {
			console.error("La librairie bracketsViewer n'est pas chargée via le CDN.");
			return;
		}

		const root = document.querySelector("#brackets-viewer");
		if (!root) return;

		// Avatars Discord → images du viewer (participantId = bm_participant.id)
		const images = this.participants
			.filter((p) => p.bracketParticipantId != null && p.user?.avatar)
			.map((p) => ({
				participantId: Number(p.bracketParticipantId),
				imageUrl: p.user.avatar as string,
			}));
		if (typeof bracketsViewer.setParticipantImages === "function") {
			bracketsViewer.setParticipantImages(images);
		}

		// Préfère le français (locale embarquée dans brackets-viewer)
		try {
			localStorage.setItem("i18nextLng", "fr");
		} catch {
			/* ignore */
		}

		await bracketsViewer.render(
			{
				stages: data.stage,
				matches: data.match,
				matchGames: data.match_game,
				participants: data.participant,
			},
			{
				selector: "#brackets-viewer",
				separatedChildCountLabel: true,
				participantOriginPlacement: "before",
				highlightParticipantOnHover: true,
				showSlotsOrigin: true,
				showPopoverOnMatchLabelClick: true,
				customRoundName: (info: any) => this.frenchRoundName(info),
				// Callback hors zone Angular (lib CDN) → re-entrer pour ouvrir le dialog scores
				onMatchClick: (match: any) => {
					this.zone.run(() => {
						if (this.tournament?.internalState === TournamentState.PREPARING) return;
						if (match?.id == null) return;
						this.showMatchScoresDialog.set(Number(match.id));
						this.cdr.detectChanges();
					});
				},
				clear: true,
			}
		);

		// La largeur du tableau vient d'être décidée par la librairie : la barre miroir
		// doit s'y recaler tout de suite, sans attendre un redimensionnement.
		this.measureBracketScroll();

		// Marque les matchs cliquables (scores) pour le style CSS
		root.classList.toggle(
			"tp-brackets-viewer--interactive",
			this.tournament?.internalState === TournamentState.ONGOING ||
				this.tournament?.internalState === TournamentState.FINISHED
		);
	}

	/** Libellés de tours en français (brackets-viewer i18n partiel). */
	private frenchRoundName(info: any): string | undefined {
		if (!info) return undefined;
		if (info.groupType === "final-group") {
			if (info.finalType === "grand_final" || info.finalType === "grand-final") {
				return info.roundCount > 1 ? `Grande finale · M${info.roundNumber}` : "Grande finale";
			}
			if (info.finalType === "consolation_final" || info.finalType === "consolation-final") {
				return "Petite finale";
			}
			return "Finale";
		}
		if (info.groupType === "round-robin") {
			return `Journée ${info.roundNumber}`;
		}
		// fractionOfFinal : 1 = finale, 1/2 = demies, 1/4 = quarts…
		const frac = info.fractionOfFinal as number | undefined;
		if (frac === 1) return "Finale";
		if (frac === 0.5) return info.roundCount === info.roundNumber ? "Demi-finales" : "Demi-finales";
		if (frac === 0.25) return "Quarts de finale";
		if (frac === 0.125) return "Huitièmes";
		if (typeof info.roundNumber === "number") {
			if (info.roundNumber === info.roundCount) return "Finale";
			if (info.roundNumber === info.roundCount - 1) return "Demi-finales";
			return `Tour ${info.roundNumber}`;
		}
		return undefined;
	}

	protected participantName(p: ParticipantDTO): string {
		const u = p.user as { displayName?: string; username?: string };
		return u.displayName || u.username || "Joueur";
	}

	protected userLabel(
		user: { displayName?: string; username?: string } | null | undefined
	): string {
		return user?.displayName || user?.username || "Joueur";
	}

	protected userInitial(
		user: { displayName?: string; username?: string } | null | undefined
	): string {
		return this.userLabel(user).charAt(0).toUpperCase();
	}

	/** Sentinel `GOAL_AVERAGE_PERFECT` (999, voir @rosegriffon/achillea-core/tournaments) -> "∞". */
	protected formatGoalAverage(value: number): string {
		if (value >= 999) return "∞";
		return value.toFixed(2);
	}

	/**
	 * Participants proposés à la saisie d'un signalement — la liste du tournoi, pour
	 * qu'un organisateur n'ait pas à retrouver un identifiant Discord à la main.
	 */
	protected get reportCandidates(): Array<{ id: string; label: string; avatar?: string }> {
		return this.participants.map((p) => ({
			id: p.user.id,
			label: this.participantName(p),
			avatar: p.user.avatar,
		}));
	}

	protected readonly TournamentState = TournamentState;
	protected readonly ParticipantStatus = ParticipantStatus;
	protected readonly getEloImagePath = getEloImagePath;
	protected readonly scoreReportPolicyOptions = SCORE_REPORT_POLICY_OPTIONS;
}
