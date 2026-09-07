import {
	AfterViewInit,
	Component,
	ElementRef,
	OnDestroy,
	OnInit,
	computed,
	inject,
	signal,
	viewChild,
} from "@angular/core";
import { FormControl, FormsModule } from "@angular/forms";
import { DatePipe, DOCUMENT } from "@angular/common";
import { Searchbar } from "../../shared/components/searchbar/searchbar";
import { Suggestion } from "../../core/models/Suggestion";
import { Ripple } from "primeng/ripple";
import { RouterLink } from "@angular/router";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../../environments/environment";
import { TournamentsService } from "../../shared/services/tournaments-service";
import {
	MatchFormat,
	ParticipantDTO,
	Tournament,
	TournamentState,
	stageTypeToString,
} from "../../core/models/Tournament";
import { Tag } from "primeng/tag";
import { ProgressBar } from "primeng/progressbar";
import { Tooltip } from "primeng/tooltip";
import { UserAvatar } from "../../shared/components/user-avatar/user-avatar";
import {
	HERO_PARTICLE_COLORS_DARK,
	HERO_PARTICLE_COLORS_LIGHT,
	canSpawnFx,
	capParticles,
	clampParallax,
	createBurstParticles,
	isHeroUiTarget,
	lerp,
	stepParticles,
	type HeroParticle,
} from "../../core/helpers/hero-bg-fx";

interface Playlist {
	id: string;
	title: string;
	description: string;
	thumbnail: string;
	url: string;
	count: number;
}

type RippleToken = {
	id: number;
	x: number;
	y: number;
	variant: "ink" | "violet";
};

const YT_API_KEY = environment.youtubeApiKey;
const YT_CHANNEL_ID = environment.youtubeChannelId;

const FEATURED_STATES: TournamentState[] = [
	TournamentState.ONGOING,
	TournamentState.PREPARING,
	TournamentState.PREREGISTERING,
];

const STATE_PRIORITY: Record<string, number> = {
	[TournamentState.ONGOING]: 0,
	[TournamentState.PREPARING]: 1,
	[TournamentState.PREREGISTERING]: 2,
};

const FX_COOLDOWN_MS = 110;
const MAX_PARTICLES = 64;
const BURST_COUNT = 28;

@Component({
	selector: "app-homepage",
	imports: [
		FormsModule,
		Searchbar,
		RouterLink,
		Ripple,
		DatePipe,
		Tag,
		ProgressBar,
		Tooltip,
		UserAvatar,
	],
	templateUrl: "./homepage.html",
	styleUrl: "./homepage.css",
})
export class Homepage implements OnInit, AfterViewInit, OnDestroy {
	private http = inject(HttpClient);
	private tournamentsSvc = inject(TournamentsService);
	private document = inject(DOCUMENT);

	private heroRef = viewChild<ElementRef<HTMLElement>>("heroRoot");
	private canvasRef = viewChild<ElementRef<HTMLCanvasElement>>("fxCanvas");

	formControl = new FormControl<Suggestion | undefined>(undefined);
	playlists: Playlist[] = [];

	protected featuredLoading = signal(true);
	protected featured = signal<Tournament | null>(null);
	protected featuredParticipants = signal<ParticipantDTO[]>([]);
	protected otherActive = signal<Tournament[]>([]);
	protected coverBroken = signal(false);
	protected logoBroken = signal(false);
	protected nowTick = signal(Date.now());

	/** Parallax offset (px) applied only to bg image (lerped for smoothness). */
	protected parallaxX = signal(0);
	protected parallaxY = signal(0);
	/** Brief punch class on bg. */
	protected bgPunch = signal(false);
	/** CSS ripples at click (relative to hero). */
	protected ripples = signal<RippleToken[]>([]);
	protected reducedMotion = signal(false);

	private tickTimer: ReturnType<typeof setInterval> | null = null;
	private particles: HeroParticle[] = [];
	private rafId = 0;
	private lastFxAt = 0;
	private rippleSeq = 0;
	private punchTimer: ReturnType<typeof setTimeout> | null = null;
	private motionMql: MediaQueryList | null = null;
	private onMotionChange: (() => void) | null = null;
	private canvasW = 0;
	private canvasH = 0;
	private dpr = 1;
	/** Target parallax (raw); displayed values are lerped each frame. */
	private parallaxTargetX = 0;
	private parallaxTargetY = 0;

	protected readonly previewAvatars = computed(() => {
		const list = [...this.featuredParticipants()].sort((a, b) => {
			const sa = a.seed ?? Number.MAX_SAFE_INTEGER;
			const sb = b.seed ?? Number.MAX_SAFE_INTEGER;
			if (sa !== sb) return sa - sb;
			return (a.user?.username ?? "").localeCompare(b.user?.username ?? "", "fr");
		});
		return list.slice(0, 8);
	});

	protected readonly overflowCount = computed(() =>
		Math.max(0, this.featuredParticipants().length - this.previewAvatars().length)
	);

	protected readonly fillPercent = computed(() => {
		const t = this.featured();
		if (!t?.participantsNumber) return 0;
		const n = this.featuredParticipants().length;
		return Math.min(100, Math.round((n / t.participantsNumber) * 100));
	});

	protected readonly isFull = computed(() => {
		const t = this.featured();
		if (!t?.participantsNumber) return false;
		return this.featuredParticipants().length >= t.participantsNumber;
	});

	protected readonly coverUrl = computed(() => {
		const t = this.featured();
		if (!t) return null;
		const url = (t.affiche || t.logo || "").trim();
		return url || null;
	});

	protected readonly logoUrl = computed(() => {
		const t = this.featured();
		if (!t) return null;
		const url = (t.logo || t.affiche || "").trim();
		return url || null;
	});

	protected readonly countdownLabel = computed(() => {
		const t = this.featured();
		if (!t) return null;
		const s = t.internalState;
		if (s === TournamentState.ONGOING) return "En direct";
		if (s !== TournamentState.PREREGISTERING && s !== TournamentState.PREPARING) return null;
		const start = new Date(t.startsAt).getTime();
		const diff = start - this.nowTick();
		if (Number.isNaN(start)) return null;
		if (diff <= 0) return s === TournamentState.PREPARING ? "Prêt à démarrer" : "Bientôt";
		const days = Math.floor(diff / 86_400_000);
		const hours = Math.floor((diff % 86_400_000) / 3_600_000);
		const mins = Math.floor((diff % 3_600_000) / 60_000);
		const secs = Math.floor((diff % 60_000) / 1000);
		if (days > 0) return `${days}j ${hours}h ${mins}min`;
		if (hours > 0) return `${hours}h ${String(mins).padStart(2, "0")}min`;
		return `${mins}:${String(secs).padStart(2, "0")}`;
	});

	protected readonly statusHeadline = computed(() => {
		const t = this.featured();
		if (!t) return "";
		switch (t.internalState) {
			case TournamentState.ONGOING:
				return "Tournoi en cours — suis les matchs en live";
			case TournamentState.PREPARING:
				return this.isFull()
					? "Bracket en préparation — places complètes"
					: "Bracket en préparation";
			case TournamentState.PREREGISTERING:
				return this.isFull()
					? "Complet — une place peut se libérer"
					: "Inscriptions ouvertes — réserve ta place";
			default:
				return "";
		}
	});

	protected readonly bgTransform = computed(() => {
		const x = this.parallaxX();
		const y = this.parallaxY();
		// Slight overscale so parallax never shows edges
		return `translate3d(${x}px, ${y}px, 0) scale(1.06)`;
	});

	ngOnInit() {
		this.loadPlaylists();
		void this.loadFeaturedTournament();
		this.tickTimer = setInterval(() => this.nowTick.set(Date.now()), 1000);

		if (typeof window !== "undefined" && window.matchMedia) {
			this.motionMql = window.matchMedia("(prefers-reduced-motion: reduce)");
			this.reducedMotion.set(this.motionMql.matches);
			this.onMotionChange = () => this.reducedMotion.set(!!this.motionMql?.matches);
			this.motionMql.addEventListener?.("change", this.onMotionChange);
		}
	}

	ngAfterViewInit() {
		this.resizeCanvas();
		this.loop();
		if (typeof window !== "undefined") {
			window.addEventListener("resize", this.onResize, { passive: true });
		}
	}

	ngOnDestroy() {
		if (this.tickTimer) clearInterval(this.tickTimer);
		if (this.punchTimer) clearTimeout(this.punchTimer);
		if (this.rafId) cancelAnimationFrame(this.rafId);
		if (typeof window !== "undefined") {
			window.removeEventListener("resize", this.onResize);
		}
		if (this.motionMql && this.onMotionChange) {
			this.motionMql.removeEventListener?.("change", this.onMotionChange);
		}
		this.particles = [];
	}

	// ─── Background FX ──────────────────────────────────────────────

	protected onHeroPointerMove(ev: PointerEvent) {
		if (this.reducedMotion()) return;
		// Skip coarse touch for continuous parallax (avoids janky scroll conflict)
		if (ev.pointerType === "touch") return;
		const hero = this.heroRef()?.nativeElement;
		if (!hero) return;
		const r = hero.getBoundingClientRect();
		if (r.width < 1 || r.height < 1) return;
		const nx = (ev.clientX - r.left) / r.width - 0.5;
		const ny = (ev.clientY - r.top) / r.height - 0.5;
		const { x, y } = clampParallax(nx, ny, 14, 10);
		this.parallaxTargetX = x;
		this.parallaxTargetY = y;
	}

	protected onHeroPointerLeave() {
		if (this.reducedMotion()) return;
		this.parallaxTargetX = 0;
		this.parallaxTargetY = 0;
	}

	protected onHeroClick(ev: MouseEvent) {
		if (isHeroUiTarget(ev.target)) return;
		const now = performance.now();
		if (!canSpawnFx(now, this.lastFxAt, FX_COOLDOWN_MS)) return;
		this.lastFxAt = now;

		const hero = this.heroRef()?.nativeElement;
		if (!hero) return;
		const r = hero.getBoundingClientRect();
		const x = ev.clientX - r.left;
		const y = ev.clientY - r.top;

		// CSS multi-layer ripples (ink + violet)
		const idBase = ++this.rippleSeq;
		const ink: RippleToken = { id: idBase * 2, x, y, variant: "ink" };
		const violet: RippleToken = { id: idBase * 2 + 1, x, y, variant: "violet" };
		this.ripples.update((list) => [...list, ink, violet]);
		const removeAfter = this.reducedMotion() ? 200 : 900;
		window.setTimeout(() => {
			this.ripples.update((list) => list.filter((t) => t.id !== ink.id && t.id !== violet.id));
		}, removeAfter);

		// Punch filter (always; shorter when reduced-motion)
		this.bgPunch.set(true);
		if (this.punchTimer) clearTimeout(this.punchTimer);
		this.punchTimer = setTimeout(() => this.bgPunch.set(false), this.reducedMotion() ? 120 : 300);

		if (this.reducedMotion()) return;

		// Canvas particles (CSS px coords match canvas after resize)
		const light = this.document.documentElement.classList.contains("p-light");
		const colors = light ? HERO_PARTICLE_COLORS_LIGHT : HERO_PARTICLE_COLORS_DARK;
		const burst = createBurstParticles(x, y, colors, BURST_COUNT);
		this.particles.push(...burst);
		capParticles(this.particles, MAX_PARTICLES);
	}

	private onResize = () => this.resizeCanvas();

	private resizeCanvas() {
		const canvas = this.canvasRef()?.nativeElement;
		const hero = this.heroRef()?.nativeElement;
		if (!canvas || !hero) return;
		const r = hero.getBoundingClientRect();
		this.dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
		this.canvasW = Math.max(1, Math.floor(r.width));
		this.canvasH = Math.max(1, Math.floor(r.height));
		canvas.width = Math.floor(this.canvasW * this.dpr);
		canvas.height = Math.floor(this.canvasH * this.dpr);
		canvas.style.width = `${this.canvasW}px`;
		canvas.style.height = `${this.canvasH}px`;
		const ctx = canvas.getContext("2d");
		if (ctx) ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
	}

	private hadParticles = false;

	private loop = () => {
		this.rafId = requestAnimationFrame(this.loop);

		// Smooth parallax toward target (desktop only; reduced-motion holds at 0)
		if (!this.reducedMotion()) {
			const nx = lerp(this.parallaxX(), this.parallaxTargetX, 0.12);
			const ny = lerp(this.parallaxY(), this.parallaxTargetY, 0.12);
			if (nx !== this.parallaxX() || ny !== this.parallaxY()) {
				this.parallaxX.set(nx);
				this.parallaxY.set(ny);
			}
		} else if (this.parallaxX() !== 0 || this.parallaxY() !== 0) {
			this.parallaxX.set(0);
			this.parallaxY.set(0);
			this.parallaxTargetX = 0;
			this.parallaxTargetY = 0;
		}

		const canvas = this.canvasRef()?.nativeElement;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		if (this.reducedMotion()) {
			if (this.particles.length || this.hadParticles) {
				this.particles = [];
				this.hadParticles = false;
				ctx.clearRect(0, 0, this.canvasW, this.canvasH);
			}
			return;
		}

		if (!this.particles.length) {
			if (this.hadParticles) {
				ctx.clearRect(0, 0, this.canvasW, this.canvasH);
				this.hadParticles = false;
			}
			return;
		}

		// Keep canvas sized if hero grew (featured load)
		const hero = this.heroRef()?.nativeElement;
		if (hero) {
			const r = hero.getBoundingClientRect();
			if (Math.abs(r.width - this.canvasW) > 2 || Math.abs(r.height - this.canvasH) > 2) {
				this.resizeCanvas();
			}
		}

		this.hadParticles = true;
		ctx.clearRect(0, 0, this.canvasW, this.canvasH);
		stepParticles(this.particles);
		for (const p of this.particles) {
			const alpha = Math.max(0, p.life / p.maxLife);
			// Soft glow core
			ctx.beginPath();
			ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.35})`;
			ctx.arc(p.x, p.y, p.size * (1.4 + alpha * 0.6), 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.92})`;
			ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.55), 0, Math.PI * 2);
			ctx.fill();
		}
	};

	// ─── Featured tournament ────────────────────────────────────────

	private async loadFeaturedTournament() {
		this.featuredLoading.set(true);
		this.coverBroken.set(false);
		this.logoBroken.set(false);

		try {
			const list = await this.tournamentsSvc.listTournamentsQuiet(1, 12, FEATURED_STATES);
			const ranked = this.rankFeaturedCandidates(list);
			if (ranked.length === 0) {
				this.featured.set(null);
				this.featuredParticipants.set([]);
				this.otherActive.set([]);
				return;
			}

			const primary = ranked[0]!;
			this.otherActive.set(ranked.slice(1, 4));

			const detail = await this.tournamentsSvc.getTournamentQuiet(primary.id);
			if (detail) {
				this.featured.set(detail[0]);
				this.featuredParticipants.set(detail[1] ?? []);
			} else {
				this.featured.set(primary);
				this.featuredParticipants.set([]);
			}
			// Canvas may need resize after featured paints
			queueMicrotask(() => this.resizeCanvas());
		} finally {
			this.featuredLoading.set(false);
		}
	}

	private rankFeaturedCandidates(list: Tournament[]): Tournament[] {
		const now = Date.now();
		return [...list]
			.filter((t) => FEATURED_STATES.includes(t.internalState))
			.sort((a, b) => {
				const pa = STATE_PRIORITY[a.internalState] ?? 9;
				const pb = STATE_PRIORITY[b.internalState] ?? 9;
				if (pa !== pb) return pa - pb;
				const ta = new Date(a.startsAt).getTime();
				const tb = new Date(b.startsAt).getTime();
				if (a.internalState === TournamentState.ONGOING) {
					return tb - ta;
				}
				const da = Math.abs(ta - now);
				const db = Math.abs(tb - now);
				return da - db;
			});
	}

	protected stateLabel(state: TournamentState): string {
		switch (state) {
			case TournamentState.PREREGISTERING:
				return "Inscriptions";
			case TournamentState.PREPARING:
				return "Préparation";
			case TournamentState.ONGOING:
				return "En cours";
			default:
				return String(state);
		}
	}

	protected stateSeverity(
		state: TournamentState
	): "success" | "info" | "warn" | "danger" | "secondary" | "contrast" {
		switch (state) {
			case TournamentState.PREREGISTERING:
				return "success";
			case TournamentState.PREPARING:
				return "info";
			case TournamentState.ONGOING:
				return "danger";
			default:
				return "secondary";
		}
	}

	protected typeLabel(type: string | null | undefined): string {
		if (!type) return "Tournoi";
		return stageTypeToString(type as any) ?? type.replace(/_/g, " ");
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
				return format ? String(format) : "";
		}
	}

	protected participantName(p: ParticipantDTO): string {
		return p.user?.username || "Joueur";
	}

	protected ctaLabel(t: Tournament): string {
		if (t.internalState === TournamentState.ONGOING) return "Suivre le bracket";
		if (t.internalState === TournamentState.PREREGISTERING && !this.isFull()) {
			return "S'inscrire";
		}
		return "Voir le tournoi";
	}

	protected ctaIcon(t: Tournament): string {
		if (t.internalState === TournamentState.ONGOING) return "pi pi-sitemap";
		if (t.internalState === TournamentState.PREREGISTERING && !this.isFull()) {
			return "pi pi-user-plus";
		}
		return "pi pi-arrow-right";
	}

	private loadPlaylists() {
		const url = `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&channelId=${YT_CHANNEL_ID}&maxResults=6&key=${YT_API_KEY}`;

		this.http.get<any>(url).subscribe({
			next: (res) => {
				this.playlists = (res.items || []).map((item: any) => ({
					id: item.id,
					title: item.snippet.title,
					description: item.snippet.description || "Playlist Achillea",
					thumbnail:
						item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || "",
					url: `https://www.youtube.com/playlist?list=${item.id}`,
					count: item.contentDetails?.itemCount || 0,
				}));
			},
			error: () => {
				this.playlists = [
					{
						id: "PLcKB9TqcHTYUw8SoFrbhBl6aQU3GZiZdr",
						title: "Astral Cup",
						description: "Tournoi accrédité Achillea",
						thumbnail: "https://i.ytimg.com/vi/BooGtg46kZQ/mqdefault.jpg",
						url: "https://www.youtube.com/playlist?list=PLcKB9TqcHTYUw8SoFrbhBl6aQU3GZiZdr",
						count: 15,
					},
					{
						id: "PLcKB9TqcHTYWBZ0ua3NQJCA-wFGUeVCLp",
						title: "The Bloom Combine",
						description: "Tournoi entre 64 joueurs",
						thumbnail: "https://i.ytimg.com/vi/25oRrdeMfFs/mqdefault.jpg",
						url: "https://www.youtube.com/playlist?list=PLcKB9TqcHTYWBZ0ua3NQJCA-wFGUeVCLp",
						count: 14,
					},
				];
			},
		});
	}

	openDiscord() {
		window.open("https://discord.gg/achillea", "_blank");
	}

	openTwitch() {
		window.open("https://twitch.tv/Achillea_IE", "_blank");
	}

	openYouTube() {
		window.open("https://youtube.com/@achillearg", "_blank");
	}

	protected readonly TournamentState = TournamentState;
}
