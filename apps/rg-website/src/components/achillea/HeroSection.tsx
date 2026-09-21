"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Tournament, ParticipantDTO } from "@rosegriffon/achillea-types";
import { TournamentState } from "@rosegriffon/achillea-types";
import {
	stageTypeLabel,
	tournamentStateLabel,
	tournamentStateTone,
} from "@rosegriffon/achillea-core";
import {
	badgeVariant,
	canSpawnFx,
	capParticles,
	clampParallax,
	createBurstParticles,
	isHeroUiTarget,
	lerp,
	stepParticles,
	type HeroParticle,
	HERO_PARTICLE_COLORS_DARK,
	HERO_PARTICLE_COLORS_LIGHT,
} from "@/lib/achillea";
import { UserAvatar } from "./UserAvatar";
import { Badge, Button } from "@rosegriffon/ui";
import {
	Search,
	Users,
	Trophy,
	Calendar,
	Bolt,
	Clock,
	ArrowRight,
	ExternalLink,
	PlayCircle,
	Swords,
} from "lucide-react";
import { FaDiscord, FaTwitch } from "react-icons/fa6";

interface RippleToken {
	id: number;
	x: number;
	y: number;
	variant: "ink" | "violet";
}

interface HeroSectionProps {
	featured: Tournament | any;
	featuredParticipants: ParticipantDTO[] | any[];
	otherActive: Tournament[] | any[];
}

export function HeroSection({
	featured,
	featuredParticipants,
	otherActive,
}: HeroSectionProps) {
	const heroRef = useRef<HTMLDivElement>(null);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const [parallax, setParallax] = useState({ x: 0, y: 0 });
	const parallaxTarget = useRef({ x: 0, y: 0 });
	const [ripples, setRipples] = useState<RippleToken[]>([]);
	const [bgPunch, setBgPunch] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [now, setNow] = useState(Date.now());

	const particlesRef = useRef<HeroParticle[]>([]);
	const lastFxAt = useRef(0);
	const rippleSeq = useRef(0);
	const rafId = useRef(0);

	// Ticker pour le décompte
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	// Animation loop pour parallaxe lissée et particules
	useEffect(() => {
		const canvas = canvasRef.current;
		const hero = heroRef.current;
		if (!canvas || !hero) return;

		let dpr = Math.min(window.devicePixelRatio || 1, 2);
		let width = hero.clientWidth;
		let height = hero.clientHeight;

		const resize = () => {
			if (!canvas || !hero) return;
			width = hero.clientWidth;
			height = hero.clientHeight;
			canvas.width = Math.floor(width * dpr);
			canvas.height = Math.floor(height * dpr);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			const ctx = canvas.getContext("2d");
			if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		resize();
		window.addEventListener("resize", resize);

		const loop = () => {
			// Parallaxe
			setParallax((prev) => {
				const nx = lerp(prev.x, parallaxTarget.current.x, 0.12);
				const ny = lerp(prev.y, parallaxTarget.current.y, 0.12);
				return { x: nx, y: ny };
			});

			// Canvas FX
			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.clearRect(0, 0, width, height);
				if (particlesRef.current.length > 0) {
					stepParticles(particlesRef.current);
					for (const p of particlesRef.current) {
						const alpha = Math.max(0, p.life / p.maxLife);
						ctx.beginPath();
						ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.4})`;
						ctx.arc(p.x, p.y, p.size * (1.5 + alpha * 0.5), 0, Math.PI * 2);
						ctx.fill();

						ctx.beginPath();
						ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.9})`;
						ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
						ctx.fill();
					}
				}
			}

			rafId.current = requestAnimationFrame(loop);
		};

		rafId.current = requestAnimationFrame(loop);

		return () => {
			window.removeEventListener("resize", resize);
			cancelAnimationFrame(rafId.current);
		};
	}, []);

	const onPointerMove = useCallback((ev: React.PointerEvent) => {
		if (ev.pointerType === "touch" || !heroRef.current) return;
		const r = heroRef.current.getBoundingClientRect();
		if (r.width < 1 || r.height < 1) return;
		const nx = (ev.clientX - r.left) / r.width - 0.5;
		const ny = (ev.clientY - r.top) / r.height - 0.5;
		parallaxTarget.current = clampParallax(nx, ny, 16, 12);
	}, []);

	const onPointerLeave = useCallback(() => {
		parallaxTarget.current = { x: 0, y: 0 };
	}, []);

	const onClick = useCallback((ev: React.MouseEvent) => {
		if (isHeroUiTarget(ev.target) || !heroRef.current) return;
		const currentNow = performance.now();
		if (!canSpawnFx(currentNow, lastFxAt.current, 100)) return;
		lastFxAt.current = currentNow;

		const r = heroRef.current.getBoundingClientRect();
		const x = ev.clientX - r.left;
		const y = ev.clientY - r.top;

		const idBase = ++rippleSeq.current;
		const ink: RippleToken = { id: idBase * 2, x, y, variant: "ink" };
		const violet: RippleToken = { id: idBase * 2 + 1, x, y, variant: "violet" };
		setRipples((prev) => [...prev, ink, violet]);
		setTimeout(() => {
			setRipples((prev) => prev.filter((item) => item.id !== ink.id && item.id !== violet.id));
		}, 900);

		setBgPunch(true);
		setTimeout(() => setBgPunch(false), 250);

		const isDark = document.documentElement.classList.contains("dark");
		const colors = isDark ? HERO_PARTICLE_COLORS_DARK : HERO_PARTICLE_COLORS_LIGHT;
		const burst = createBurstParticles(x, y, colors, 24);
		particlesRef.current.push(...burst);
		capParticles(particlesRef.current, 60);
	}, []);

	// Calculs décompte tournoi
	const countdownLabel = (() => {
		if (!featured) return null;
		if (featured.internalState === TournamentState.ONGOING) return "En direct";
		if (
			featured.internalState !== TournamentState.PREREGISTERING &&
			featured.internalState !== TournamentState.PREPARING
		) {
			return null;
		}
		const start = new Date(featured.startsAt).getTime();
		const diff = start - now;
		if (Number.isNaN(start) || diff <= 0) return "Bientôt";
		const days = Math.floor(diff / 86_400_000);
		const hours = Math.floor((diff % 86_400_000) / 3_600_000);
		const mins = Math.floor((diff % 3_600_000) / 60_000);
		if (days > 0) return `${days}j ${hours}h ${mins}min`;
		return `${hours}h ${String(mins).padStart(2, "0")}min`;
	})();

	const fillPct = featured?.participantsNumber
		? Math.min(
				100,
				Math.round((featuredParticipants.length / featured.participantsNumber) * 100)
			)
		: 0;

	return (
		<div
			ref={heroRef}
			onClick={onClick}
			onPointerMove={onPointerMove}
			onPointerLeave={onPointerLeave}
			className="relative overflow-hidden pt-10 pb-16 px-4 sm:px-6 lg:px-8 border-b border-outline/15 min-h-[600px] flex flex-col justify-center"
		>
			{/* Parallax Background Layer with Official Achilléa Art */}
			<div
				className={`absolute inset-0 pointer-events-none transition-transform duration-75 overflow-hidden ${
					bgPunch ? "scale-[1.03] filter brightness-110" : ""
				}`}
				style={{
					transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0) scale(1.08)`,
				}}
			>
				<div className="achillea-hero-bg" />
				<div className="achillea-hero-vignette" />
				<div
					className="absolute inset-0 opacity-15 mix-blend-overlay pointer-events-none"
					style={{ backgroundImage: "url(/images/noise.svg)" }}
				/>
				<div className="absolute -right-24 -top-24 size-[480px] bg-[#6d00ce] rounded-full blur-[140px] opacity-25" />
				<div className="absolute -left-24 -bottom-24 size-[480px] bg-[#DFFF57] rounded-full blur-[140px] opacity-15" />
			</div>

			{/* Canvas Particles FX */}
			<canvas
				ref={canvasRef}
				className="absolute inset-0 pointer-events-none z-10 size-full"
			/>

			{/* Ripples */}
			{ripples.map((r) => (
				<span
					key={r.id}
					className={`hero-ripple ${
						r.variant === "violet" ? "hero-ripple--violet" : "hero-ripple--ink"
					}`}
					style={{
						left: r.x,
						top: r.y,
					}}
				/>
			))}

			{/* Content Container */}
			<div className="relative z-20 max-w-5xl mx-auto w-full space-y-8 text-center">
				{/* Header & Logo */}
				<div className="space-y-4">
					<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#6d00ce]/10 border border-[#6d00ce]/30 text-[#6d00ce] text-xs font-black uppercase tracking-wider shadow-sm">
						<Swords className="size-3.5" />
						E-Sport Inazuma Eleven
					</div>

					<div className="relative h-20 sm:h-28 w-full max-w-lg mx-auto">
						<Image
							src="/achillea/achillea site titre transparent-2.webp"
							alt="ACHILLÉA"
							fill
							priority
							className="object-contain drop-shadow-[0_4px_16px_rgba(223,255,87,0.3)]"
						/>
					</div>

					<p className="text-sm sm:text-base md:text-lg text-on-surface-variant max-w-2xl mx-auto font-medium">
						Le carrefour communautaire de la scène compétitive Inazuma Eleven: Victory Road.
						Clans, tournois homologués, classement classé et ligues majeures.
					</p>
				</div>

				{/* Search Bar rapide */}
				<div className="max-w-xl mx-auto">
					<form
						onSubmit={(e) => {
							e.preventDefault();
							if (searchQuery.trim()) {
								window.location.href = `/achillea/clans?q=${encodeURIComponent(searchQuery.trim())}`;
							}
						}}
						className="relative flex items-center shadow-lg rounded-2xl overflow-hidden border border-outline/30 bg-surface/90 backdrop-blur-md focus-within:border-primary transition-all"
					>
						<Search className="size-5 ml-4 text-on-surface-variant shrink-0" />
						<input
							type="search"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Rechercher un clan, un joueur ou un tournoi…"
							className="w-full py-3.5 px-3.5 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none"
						/>
						<Button type="submit" size="sm" className="mr-2 rounded-xl text-xs font-bold">
							Chercher
						</Button>
					</form>
				</div>

				{/* ========== TOURNOI À LA UNE ========== */}
				{featured && (
					<div className="pt-4 text-left">
						<div className="flex items-center justify-between mb-3 px-1">
							<div className="flex items-center gap-2">
								<span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-primary">
									<Trophy className="size-4" />
									À la une
								</span>
								{countdownLabel && (
									<Badge
										variant={
											featured.internalState === TournamentState.ONGOING
												? "destructive"
												: "secondary"
										}
										className="text-[11px] gap-1 font-bold"
									>
										<Clock className="size-3" />
										{countdownLabel}
									</Badge>
								)}
							</div>

							<Link
								href="/achillea/tournaments"
								className="text-xs font-bold text-on-surface-variant hover:text-primary flex items-center gap-1 transition-colors"
							>
								Tous les tournois
								<ArrowRight className="size-3" />
							</Link>
						</div>

						{/* Carte Featured */}
						<Link
							href={`/achillea/tournaments/${featured.id}`}
							className="block group rounded-3xl border border-outline/25 bg-surface/90 hover:border-primary/60 transition-all duration-300 shadow-xl overflow-hidden relative"
						>
							<div className="grid md:grid-cols-3 gap-0">
								{/* Cover Image */}
								<div className="relative aspect-video md:aspect-auto md:h-full w-full overflow-hidden bg-surface-variant">
									{featured.affiche || featured.logo ? (
										<Image
											src={featured.affiche || featured.logo || ""}
											alt={featured.name}
											fill
											unoptimized
											className="object-cover group-hover:scale-105 transition-transform duration-500"
										/>
									) : (
										<div className="size-full flex items-center justify-center text-on-surface-variant">
											<Trophy className="size-16 opacity-30" />
										</div>
									)}
									<div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent md:hidden" />
								</div>

								{/* Details */}
								<div className="p-6 md:p-8 md:col-span-2 flex flex-col justify-between space-y-4">
									<div className="space-y-2">
										<div className="flex items-center gap-2">
											<Badge
												variant={badgeVariant(
													tournamentStateTone(featured.internalState)
												)}
												className="text-xs font-bold"
											>
												{tournamentStateLabel(featured.internalState)}
											</Badge>
											<span className="text-xs text-on-surface-variant font-medium">
												{stageTypeLabel(featured.tournamentType)}
											</span>
										</div>

										<h3 className="text-xl sm:text-2xl font-black text-on-surface group-hover:text-primary transition-colors">
											{featured.name}
										</h3>

										{featured.organization && (
											<p className="text-xs text-on-surface-variant">
												Organisé par{" "}
												<strong className="text-on-surface">
													{featured.organization.name}
												</strong>
											</p>
										)}
									</div>

									{/* Specs */}
									<div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-on-surface-variant py-1">
										<div className="flex items-center gap-1.5">
											<Calendar className="size-4 text-primary shrink-0" />
											<span>
												{new Date(featured.startsAt).toLocaleDateString("fr-FR", {
													day: "numeric",
													month: "short",
													hour: "2-digit",
													minute: "2-digit",
												})}
											</span>
										</div>
										<div className="flex items-center gap-1.5">
											<Users className="size-4 text-primary shrink-0" />
											<span>
												{featuredParticipants.length} /{" "}
												{featured.participantsNumber} inscrits
											</span>
										</div>
										<div className="flex items-center gap-1.5">
											<Bolt className="size-4 text-primary shrink-0" />
											<span>Format homologué</span>
										</div>
									</div>

									{/* Progress bar */}
									<div className="space-y-1.5">
										<div className="flex justify-between text-xs font-bold text-on-surface-variant">
											<span>Remplissage</span>
											<span>{fillPct}%</span>
										</div>
										<div className="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
											<div
												className="h-full bg-primary rounded-full transition-all duration-700"
												style={{ width: `${fillPct}%` }}
											/>
										</div>
									</div>

									{/* Participants Preview Avatars */}
									{featuredParticipants.length > 0 && (
										<div className="flex items-center gap-3 pt-1">
											<div className="flex -space-x-2 overflow-hidden">
												{featuredParticipants.slice(0, 7).map((p) => (
													<UserAvatar
														key={p.id}
														userId={p.user?.id}
														avatar={p.user?.avatar}
														name={p.user?.username}
														size="sm"
														className="ring-2 ring-surface"
													/>
												))}
											</div>
											{featuredParticipants.length > 7 && (
												<span className="text-xs font-bold text-on-surface-variant">
													+{featuredParticipants.length - 7} joueurs
												</span>
											)}
										</div>
									)}

									{/* Action footer */}
									<div className="pt-2 flex items-center justify-between">
										<Button className="font-bold text-xs rounded-xl shadow-md gap-1.5">
											{featured.internalState === TournamentState.ONGOING
												? "Suivre en direct"
												: "Voir le tournoi"}
											<ArrowRight className="size-3.5" />
										</Button>

										<span className="text-xs font-bold text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
											Ouvrir le bracket
										</span>
									</div>
								</div>
							</div>
						</Link>

						{/* Autres tournois actifs */}
						{otherActive.length > 0 && (
							<div className="mt-4 flex flex-wrap gap-2 items-center">
								<span className="text-xs font-bold text-on-surface-variant mr-1">
									Aussi en activité :
								</span>
								{otherActive.map((o) => (
									<Link
										key={o.id}
										href={`/achillea/tournaments/${o.id}`}
										className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-outline/20 bg-surface/70 hover:border-primary/50 text-xs font-semibold text-on-surface transition-all"
									>
										<span className="truncate max-w-[150px]">{o.name}</span>
										<Badge
											variant={badgeVariant(tournamentStateTone(o.internalState))}
											className="text-[10px] px-1.5 py-0"
										>
											{tournamentStateLabel(o.internalState)}
										</Badge>
									</Link>
								))}
							</div>
						)}
					</div>
				)}

				{/* Cartes d'accès rapide */}
				<div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 text-left">
					{/* Clans */}
					<Link
						href="/achillea/clans"
						className="p-5 rounded-2xl border border-outline/20 bg-surface hover:border-primary/50 hover:shadow-lg transition-all group space-y-2"
					>
						<div className="size-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
							<Users className="size-5" />
						</div>
						<h4 className="font-black text-base text-on-surface group-hover:text-primary transition-colors">
							Clans
						</h4>
						<p className="text-xs text-on-surface-variant line-clamp-2">
							Rejoins ou fonde ton clan et hisse ton équipe au sommet.
						</p>
					</Link>

					{/* Ranked */}
					<Link
						href="/achillea/ranked"
						className="p-5 rounded-2xl border border-outline/20 bg-surface hover:border-primary/50 hover:shadow-lg transition-all group space-y-2"
					>
						<div className="size-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
							<Swords className="size-5" />
						</div>
						<h4 className="font-black text-base text-on-surface group-hover:text-primary transition-colors">
							Ranked ELO
						</h4>
						<p className="text-xs text-on-surface-variant line-clamp-2">
							File 1v1 / 2v2, 11 paliers ELO et matchmaking continu.
						</p>
					</Link>

					{/* Twitch */}
					<a
						href="https://twitch.tv/Achillea_IE"
						target="_blank"
						rel="noopener noreferrer"
						className="p-5 rounded-2xl border border-outline/20 bg-surface hover:border-purple-500/50 hover:shadow-lg transition-all group space-y-2"
					>
						<div className="size-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center font-bold">
							<FaTwitch className="size-5" />
						</div>
						<div className="flex items-center justify-between">
							<h4 className="font-black text-base text-on-surface group-hover:text-purple-500 transition-colors">
								Twitch
							</h4>
							<ExternalLink className="size-3.5 text-on-surface-variant" />
						</div>
						<p className="text-xs text-on-surface-variant line-clamp-2">
							Matchs retransmis et commentés en direct par le staff.
						</p>
					</a>

					{/* Discord */}
					<a
						href="https://discord.gg/achillea"
						target="_blank"
						rel="noopener noreferrer"
						className="p-5 rounded-2xl border border-outline/20 bg-surface hover:border-indigo-500/50 hover:shadow-lg transition-all group space-y-2"
					>
						<div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center font-bold">
							<FaDiscord className="size-5" />
						</div>
						<div className="flex items-center justify-between">
							<h4 className="font-black text-base text-on-surface group-hover:text-indigo-500 transition-colors">
								Discord
							</h4>
							<ExternalLink className="size-3.5 text-on-surface-variant" />
						</div>
						<p className="text-xs text-on-surface-variant line-clamp-2">
							Serveur communautaire avec bot, matchmaking et salons d'équipe.
						</p>
					</a>
				</div>
			</div>
		</div>
	);
}
