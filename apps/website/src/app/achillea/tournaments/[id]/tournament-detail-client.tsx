"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
	createAchilleaClient,
	useAchilleaAuth,
	stageTypeLabel,
	tournamentStateLabel,
	tournamentStateTone,
	badgeVariant,
	placementPrizeAp,
} from "@/lib/achillea";
import { UserAvatar } from "@/components/achillea/UserAvatar";
import { Badge, Button, Card, Skeleton } from "@rosegriffon/ui";
import type { WireTournament, WireParticipant } from "@rosegriffon/achillea-types/domain/tournament-ops";
import { TournamentState } from "@rosegriffon/achillea-types/enums/eventEnums";
import {
	Trophy,
	ArrowLeft,
	Calendar,
	Users,
	ShieldCheck,
	Clock,
	Layers,
	ExternalLink,
	CheckCircle2,
	AlertCircle,
	Coins,
	FileText,
	Swords,
	UserPlus,
	UserMinus,
	Loader2,
} from "lucide-react";

export default function TournamentDetailPage({ id }: { id: string }) {
	const tournamentId = parseInt(id, 10);

	const { user, isAuthenticated, login } = useAchilleaAuth();

	const [tournament, setTournament] = useState<WireTournament | null>(null);
	const [participants, setParticipants] = useState<WireParticipant[]>([]);
	const [bracketData, setBracketData] = useState<unknown>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<"overview" | "bracket" | "participants" | "organizers">("overview");

	const [isRegistering, setIsRegistering] = useState<boolean>(false);

	useEffect(() => {
		if (isNaN(tournamentId)) {
			setError("Identifiant de tournoi invalide.");
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient();

		client.tournaments
			.get(tournamentId)
			.then((res) => {
				if (cancelled) return;
				if (res.ok && res.value) {
					setTournament(res.value[0]);
					setParticipants(res.value[1] ?? []);
					setBracketData(res.value[2] ?? null);
				} else {
					setError("Tournoi introuvable ou indisponible.");
				}
			})
			.catch(() => {
				if (!cancelled) setError("Erreur de communication avec le serveur.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [tournamentId]);

	const isUserRegistered = Boolean(
		user && participants.some((p) => p.user?.id === user.id)
	);

	const handleToggleRegister = async () => {
		if (!isAuthenticated) {
			login();
			return;
		}
		if (!tournament) return;

		setIsRegistering(true);
		const client = createAchilleaClient({ credentials: "include" });

		try {
			if (isUserRegistered) {
				await client.tournaments.unregister(tournament.id);
				setParticipants((prev) => prev.filter((p) => p.user?.id !== user?.id));
			} else {
				await client.tournaments.participate(tournament.id);
				// Refresh participants list
				const ref = await client.tournaments.get(tournament.id);
				if (ref.ok) {
					setParticipants(ref.value[1] ?? []);
				}
			}
		} finally {
			setIsRegistering(false);
		}
	};

	if (loading) {
		return (
			<div className="max-w-5xl mx-auto px-4 py-12 space-y-6">
				<Skeleton className="h-8 w-48 rounded-lg" />
				<Skeleton className="h-64 w-full rounded-2xl" />
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<Skeleton className="h-48 md:col-span-2 rounded-2xl" />
					<Skeleton className="h-48 rounded-2xl" />
				</div>
			</div>
		);
	}

	if (error || !tournament) {
		return (
			<div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
				<AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
				<h2 className="text-xl font-bold">{error ?? "Tournoi introuvable"}</h2>
				<Button asChild variant="outline">
					<Link href="/achillea/tournaments">
						<ArrowLeft className="w-4 h-4 mr-2" />
						Retour aux tournois
					</Link>
				</Button>
			</div>
		);
	}

	const tone = tournamentStateTone(tournament.internalState);
	const variant = badgeVariant(tone);
	const stateLabel = tournamentStateLabel(tournament.internalState);
	const formatLabel = stageTypeLabel(tournament.tournamentType);

	const startDate = new Date(tournament.startsAt).toLocaleDateString("fr-FR", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	// `participantsNumber` est `null` tant que le format n'est pas figé : le
	// barème de podium n'a alors pas de sens, on le calcule sur 0.
	const nbParticipants = tournament.participantsNumber ?? 0;
	const firstPrize = placementPrizeAp(nbParticipants, 1);
	const secondPrize = placementPrizeAp(nbParticipants, 2);
	const semiPrize = placementPrizeAp(nbParticipants, 3);

	return (
		<div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
			{/* Top breadcrumb */}
			<div className="space-y-1">
				<Link
					href="/achillea/tournaments"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					Retour aux tournois
				</Link>
			</div>

			{/* Tournament Hero Card */}
			<div className="relative border border-border bg-card rounded-3xl overflow-hidden shadow-sm">
				{/* Banner background if available */}
				{tournament.affiche && (
					<div className="relative w-full h-48 md:h-64 overflow-hidden">
						<Image
							src={tournament.affiche}
							alt={tournament.name}
							fill
							unoptimized
							className="object-cover brightness-75"
						/>
						<div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
					</div>
				)}

				<div className={`p-6 md:p-8 ${tournament.affiche ? "-mt-16 relative z-10" : ""}`}>
					<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
						<div className="flex items-center gap-5">
							<div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-muted shrink-0 border-2 border-border shadow-md">
								{tournament.logo ? (
									<Image
										src={tournament.logo}
										alt={tournament.name}
										fill
										unoptimized
										className="object-cover"
									/>
								) : (
									<div className="w-full h-full flex items-center justify-center text-muted-foreground">
										<Trophy className="w-8 h-8 text-amber-400" />
									</div>
								)}
							</div>

							<div className="space-y-1.5">
								<div className="flex flex-wrap items-center gap-2">
									<h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
										{tournament.name}
									</h1>
									<Badge variant={variant} className="text-xs">
										{stateLabel}
									</Badge>
								</div>
								<div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
									<span className="font-medium text-foreground">
										{typeof tournament.organization === "object" && tournament.organization !== null
											? tournament.organization.name
											: "Achilléa Esport"}
									</span>
									<span>·</span>
									<span className="flex items-center gap-1">
										<Calendar className="w-3.5 h-3.5 text-primary" />
										{startDate}
									</span>
								</div>
							</div>
						</div>

						{/* Register action button */}
						{tournament.internalState === TournamentState.PREREGISTERING && (
							<button
								type="button"
								onClick={handleToggleRegister}
								disabled={isRegistering}
								className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs transition shadow-sm self-stretch sm:self-auto justify-center ${
									isUserRegistered
										? "bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-600/30"
										: "bg-primary text-primary-foreground hover:bg-primary/90"
								}`}
							>
								{isRegistering ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : isUserRegistered ? (
									<>
										<UserMinus className="w-4 h-4" />
										Se désinscrire
									</>
								) : (
									<>
										<UserPlus className="w-4 h-4" />
										S'inscrire au tournoi
									</>
								)}
							</button>
						)}
					</div>

					{/* Metadata strip */}
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/60 text-xs">
						<div className="p-3 rounded-xl bg-background/60 border border-border">
							<div className="text-muted-foreground">Format</div>
							<div className="font-bold text-foreground mt-0.5">{formatLabel}</div>
						</div>
						<div className="p-3 rounded-xl bg-background/60 border border-border">
							<div className="text-muted-foreground">Places</div>
							<div className="font-bold text-foreground mt-0.5">
								{participants.length} / {tournament.participantsNumber}
							</div>
						</div>
						<div className="p-3 rounded-xl bg-background/60 border border-border">
							<div className="text-muted-foreground">Cashprize 1er</div>
							<div className="font-bold text-amber-400 mt-0.5">{firstPrize} AP</div>
						</div>
						<div className="p-3 rounded-xl bg-background/60 border border-border">
							<div className="text-muted-foreground">Jeu officiel</div>
							<div className="font-bold text-foreground mt-0.5">IE: Victory Road</div>
						</div>
					</div>
				</div>
			</div>

			{/* Tabs Navigation */}
			<div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
				<button
					type="button"
					onClick={() => setActiveTab("overview")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "overview"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<FileText className="w-3.5 h-3.5" />
					Présentation & Règles
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("bracket")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "bracket"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<Layers className="w-3.5 h-3.5" />
					Arbre du tournoi
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("participants")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "participants"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<Users className="w-3.5 h-3.5" />
					Participants ({participants.length})
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("organizers")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "organizers"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<ShieldCheck className="w-3.5 h-3.5" />
					Organisateurs
				</button>
			</div>

			{/* Tab 1: Overview */}
			{activeTab === "overview" && (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div className="md:col-span-2 border border-border bg-card rounded-2xl p-6 space-y-4">
						<h3 className="font-bold text-base">Règlement et Informations</h3>
						<div className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
							{tournament.description ||
								"Bienvenue dans ce tournoi officiel de la scène Achilléa. Les matchs se déroulent en salon privé sous la surveillance des arbitres officiels."}
						</div>

						<div className="pt-4 border-t border-border/60 space-y-2">
							<h4 className="font-bold text-xs text-foreground">Déroulement des rencontres :</h4>
							<ul className="list-disc list-inside text-xs text-muted-foreground space-y-1">
								<li>Format des matchs : {formatLabel}.</li>
								<li>Saisie des scores via l'interface Achilléa à la fin du match.</li>
								<li>En cas de déconnexion, capture d'écran obligatoire pour arbitrage.</li>
							</ul>
						</div>
					</div>

					<div className="border border-border bg-card rounded-2xl p-6 space-y-4">
						<h3 className="font-bold text-base flex items-center gap-2">
							<Coins className="w-4 h-4 text-amber-400" />
							Récompenses (AP)
						</h3>
						<div className="space-y-2.5 text-xs">
							<div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
								<span className="font-bold text-amber-400">1ère Place</span>
								<span className="font-mono font-bold text-foreground">+{firstPrize} AP</span>
							</div>
							<div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-400/10 border border-slate-400/20">
								<span className="font-bold text-slate-300">2ème Place</span>
								<span className="font-mono font-bold text-foreground">+{secondPrize} AP</span>
							</div>
							<div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-700/10 border border-amber-700/20">
								<span className="font-bold text-amber-600">Demi-finalistes</span>
								<span className="font-mono font-bold text-foreground">+{semiPrize} AP</span>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Tab 2: Bracket */}
			{activeTab === "bracket" && (
				<div className="border border-border bg-card rounded-2xl p-6 text-center space-y-4">
					<div className="space-y-1">
						<h3 className="font-bold text-base">Arbre de compétition</h3>
						<p className="text-xs text-muted-foreground">
							{tournament.internalState === TournamentState.PENDING ||
							tournament.internalState === TournamentState.PREREGISTERING
								? "Le bracket sera généré et verrouillé dès la clôture des inscriptions."
								: "Suivi en temps réel de l'avancement des rencontres du bracket."}
						</p>
					</div>

					{/* Bracket Tree placeholder / visualizer */}
					<div className="py-12 border border-dashed border-border rounded-xl bg-background/50 flex flex-col items-center justify-center space-y-2">
						<Layers className="w-8 h-8 text-muted-foreground/60" />
						<span className="text-xs font-semibold text-muted-foreground">
							Arbre officiel ({tournament.participantsNumber} slots)
						</span>
						<span className="text-[11px] text-muted-foreground">
							Géré via brackets-manager et synchronisé avec les lobbies Achilléa.
						</span>
					</div>
				</div>
			)}

			{/* Tab 3: Participants */}
			{activeTab === "participants" && (
				<div className="border border-border bg-card rounded-2xl overflow-hidden">
					<div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
						<h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
							Liste des compétiteurs ({participants.length} / {tournament.participantsNumber})
						</h3>
					</div>

					{participants.length === 0 ? (
						<div className="py-12 text-center text-muted-foreground text-xs">
							Aucun participant inscrit pour l'instant.
						</div>
					) : (
						<div className="divide-y divide-border/60">
							{participants.map((p, idx) => (
								<div
									key={p.id ?? idx}
									className="p-3 px-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition"
								>
									<div className="flex items-center gap-3">
										<span className="text-xs font-mono font-bold text-muted-foreground w-6 text-center">
											#{idx + 1}
										</span>
										<UserAvatar
											avatar={p.user?.avatar}
											displayName={p.user?.username || "Joueur"}
											className="w-7 h-7"
										/>
										<div>
											<span className="font-semibold text-xs text-foreground">
												{p.user?.username || "Joueur"}
											</span>
										</div>
									</div>

									<span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
										Inscrit
									</span>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* Tab 4: Organizers */}
			{activeTab === "organizers" && (
				<div className="border border-border bg-card rounded-2xl p-6 space-y-4">
					<h3 className="font-bold text-sm">Staff & Arbitres du tournoi</h3>
					<div className="p-4 rounded-xl bg-background/60 border border-border flex items-center gap-3">
						<div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
							A
						</div>
						<div>
							<div className="font-bold text-xs">
								{typeof tournament.organization === "object" && tournament.organization !== null
									? tournament.organization.name
									: "Achilléa Esport"}
							</div>
							<div className="text-[11px] text-muted-foreground">Organisateur principal</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
