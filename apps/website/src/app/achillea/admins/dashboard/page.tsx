"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAchilleaAuth, createAchilleaClient } from "@/lib/achillea";
import type { AdminOpsOverview, AdminUserRow } from "@rosegriffon/achillea-types/domain/admin";
import type { RankedAdminDispute } from "@rosegriffon/achillea-types/domain/ranked";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	Button,
	Badge,
	Skeleton,
} from "@rosegriffon/ui";
import {
	LayoutDashboard,
	Gavel,
	Calendar,
	Users,
	ShieldAlert,
	Wallet,
	Server,
	RefreshCw,
	Loader2,
	CheckCircle2,
	XCircle,
	AlertTriangle,
	ExternalLink,
	ShieldCheck,
	ArrowRight,
} from "lucide-react";

type AdminTab =
	| "overview"
	| "disputes"
	| "seasons"
	| "sanctions"
	| "users"
	| "wallets"
	| "bot";

/**
 * Met en forme une durée de fonctionnement.
 *
 * L'API rend des secondes. Les afficher brutes (« 384210 ») n'apprend rien à
 * qui surveille un service ; « 4 j 10 h » se lit d'un coup d'œil.
 */
function formaterDuree(secondes: number): string {
	if (!Number.isFinite(secondes) || secondes < 0) return "—";
	const jours = Math.floor(secondes / 86_400);
	const heures = Math.floor((secondes % 86_400) / 3_600);
	const minutes = Math.floor((secondes % 3_600) / 60);
	if (jours > 0) return `${jours} j ${heures} h`;
	if (heures > 0) return `${heures} h ${minutes} min`;
	return `${minutes} min`;
}

export default function AchilleaAdminDashboardPage() {
	const { user, isAuthenticated, isLoading: authLoading } = useAchilleaAuth();
	const [activeTab, setActiveTab] = useState<AdminTab>("overview");

	const [ops, setOps] = useState<AdminOpsOverview | null>(null);
	const [disputes, setDisputes] = useState<RankedAdminDispute[]>([]);
	const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [refreshing, setRefreshing] = useState(false);

	const client = createAchilleaClient({ credentials: "include" });

	const loadData = async () => {
		setRefreshing(true);
		try {
			const [opsRes, dispRes] = await Promise.all([
				client.admin.overview(),
				client.ranked.adminDisputes(),
			]);

			if (opsRes.ok && opsRes.value) {
				setOps(opsRes.value);
			}
			if (dispRes.ok && dispRes.value) {
				setDisputes(dispRes.value);
			}
		} catch {
			// silent fallback
		} finally {
			setRefreshing(false);
			setLoading(false);
		}
	};

	useEffect(() => {
		if (isAuthenticated) {
			setLoading(true);
			void loadData();
		}
	}, [isAuthenticated]);

	// Garde d'accès (Modérateur+)
	if (authLoading) {
		return (
			<div className="max-w-6xl mx-auto px-4 py-12 space-y-6">
				<Skeleton className="h-10 w-64" />
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<Skeleton className="h-32 rounded-xl" />
					<Skeleton className="h-32 rounded-xl" />
					<Skeleton className="h-32 rounded-xl" />
					<Skeleton className="h-32 rounded-xl" />
				</div>
			</div>
		);
	}

	if (!isAuthenticated || (user?.role ?? 0) < 1) {
		return (
			<div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
				<div className="size-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
					<ShieldAlert className="size-8" />
				</div>
				<h1 className="text-2xl font-bold">Accès Administrateur Restreint</h1>
				<p className="text-sm text-muted-foreground">
					Ce tableau de bord est réservé aux modérateurs et administrateurs d&apos;Achilléa.
				</p>
				<Link href="/achillea">
					<Button variant="outline" className="mt-4">
						Retour à l&apos;accueil
					</Button>
				</Link>
			</div>
		);
	}

	return (
		<div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
			{/* En-tête avec raccourci vers l'admin global Rose Griffon */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
				<div className="space-y-1">
					<div className="flex items-center gap-2.5">
						<span className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
							<LayoutDashboard className="size-5" />
						</span>
						<h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
							Achilléa Backoffice
						</h1>
						<Badge variant="outline" className="border-primary/40 text-primary text-xs">
							{user?.role && user.role >= 3
								? "Super-Admin"
								: user?.role && user.role >= 2
								? "Admin"
								: "Modérateur"}
						</Badge>
					</div>
					<p className="text-xs text-muted-foreground">
						Supervision des compétitions, arbitrage des litiges, économie ACH et modération.
					</p>
				</div>

				<div className="flex items-center gap-3">
					<Link
						href="/admin"
						className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/80 bg-muted/40 hover:bg-muted text-xs font-semibold transition"
						title="Administration centrale Rose Griffon (Portail & Wiki)"
					>
						<span>Admin Portail RG</span>
						<ExternalLink className="size-3 text-muted-foreground" />
					</Link>

					<Button
						variant="outline"
						size="sm"
						onClick={loadData}
						disabled={refreshing}
						className="gap-2 text-xs"
					>
						<RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
						Actualiser
					</Button>
				</div>
			</div>

			{/* Navigation par Onglets */}
			<div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3">
				<Button
					variant={activeTab === "overview" ? "default" : "ghost"}
					size="sm"
					onClick={() => setActiveTab("overview")}
					className="gap-2 text-xs"
				>
					<LayoutDashboard className="size-3.5" />
					Vue d&apos;ensemble
				</Button>

				<Button
					variant={activeTab === "disputes" ? "default" : "ghost"}
					size="sm"
					onClick={() => setActiveTab("disputes")}
					className="gap-2 text-xs relative"
				>
					<Gavel className="size-3.5" />
					Litiges Ranked
					{disputes.length > 0 && (
						<span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
							{disputes.length}
						</span>
					)}
				</Button>

				<Button
					variant={activeTab === "sanctions" ? "default" : "ghost"}
					size="sm"
					onClick={() => setActiveTab("sanctions")}
					className="gap-2 text-xs"
				>
					<ShieldAlert className="size-3.5" />
					Sanctions
				</Button>

				<Button
					variant={activeTab === "seasons" ? "default" : "ghost"}
					size="sm"
					onClick={() => setActiveTab("seasons")}
					className="gap-2 text-xs"
				>
					<Calendar className="size-3.5" />
					Saisons Ranked
				</Button>

				<Button
					variant={activeTab === "users" ? "default" : "ghost"}
					size="sm"
					onClick={() => setActiveTab("users")}
					className="gap-2 text-xs"
				>
					<Users className="size-3.5" />
					Utilisateurs & Staff
				</Button>

				<Button
					variant={activeTab === "wallets" ? "default" : "ghost"}
					size="sm"
					onClick={() => setActiveTab("wallets")}
					className="gap-2 text-xs"
				>
					<Wallet className="size-3.5" />
					Portefeuilles ACH
				</Button>

				<Button
					variant={activeTab === "bot" ? "default" : "ghost"}
					size="sm"
					onClick={() => setActiveTab("bot")}
					className="gap-2 text-xs"
				>
					<Server className="size-3.5" />
					Santé Bot & API
				</Button>
			</div>

			{/* CONTENU ONGLET: VUE D'ENSEMBLE */}
			{activeTab === "overview" && (
				<div className="space-y-6">
					{/* KPIs Grid */}
					<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
						<Card className="bg-card/50 border-border/60">
							<CardContent className="p-4 space-y-1">
								<div className="text-xs text-muted-foreground">Membres inscrits</div>
								<div className="text-2xl font-bold">{ops?.users?.total ?? 0}</div>
								<div className="text-[11px] text-muted-foreground">
									{ops?.users?.staff ?? 0} staff
								</div>
							</CardContent>
						</Card>

						<Card className="bg-card/50 border-border/60">
							<CardContent className="p-4 space-y-1">
								<div className="text-xs text-muted-foreground">Litiges ouverts</div>
								<div
									className={`text-2xl font-bold ${
										(ops?.ranked?.contestedMatches ?? 0) > 0 ? "text-rose-400" : "text-emerald-400"
									}`}
								>
									{ops?.ranked?.contestedMatches ?? disputes.length}
								</div>
								<div className="text-[11px] text-muted-foreground">À trancher</div>
							</CardContent>
						</Card>

						<Card className="bg-card/50 border-border/60">
							<CardContent className="p-4 space-y-1">
								<div className="text-xs text-muted-foreground">Matchs en cours</div>
								<div className="text-2xl font-bold text-amber-400">
									{ops?.ranked?.activeMatches ?? 0}
								</div>
								<div className="text-[11px] text-muted-foreground">Lobbies actifs</div>
							</CardContent>
						</Card>

						<Card className="bg-card/50 border-border/60">
							<CardContent className="p-4 space-y-1">
								<div className="text-xs text-muted-foreground">Clans en attente</div>
								<div className="text-2xl font-bold">{ops?.community?.clansPending ?? 0}</div>
								<div className="text-[11px] text-muted-foreground">Validation fondateurs</div>
							</CardContent>
						</Card>

						<Card className="bg-card/50 border-border/60">
							<CardContent className="p-4 space-y-1">
								<div className="text-xs text-muted-foreground">Organisations</div>
								<div className="text-2xl font-bold">{ops?.community?.orgsPending ?? 0}</div>
								<div className="text-[11px] text-muted-foreground">
									<Link
										href="/achillea/organizations/validate"
										className="text-primary hover:underline"
									>
										Voir validation
									</Link>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-card/50 border-border/60">
							<CardContent className="p-4 space-y-1">
								<div className="text-xs text-muted-foreground">Bot Uptime</div>
								<div className="text-2xl font-bold font-mono">
									{ops?.bot?.uptime ? `${Math.floor(ops.bot.uptime / 3600)}h` : "Actif"}
								</div>
								<div className="text-[11px] text-emerald-400">
									{ops?.bot?.online ? "En ligne" : "Inactif"}
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Raccourcis d'actions rapides */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
						<Card className="border-border/60">
							<CardHeader className="p-5 pb-2">
								<CardTitle className="text-base flex items-center justify-between">
									<span className="flex items-center gap-2">
										<Gavel className="size-4 text-primary" />
										Arbitrage Ranked
									</span>
									<Link href="/achillea/admins/ranked-disputes">
										<Button variant="ghost" size="sm" className="size-7 p-0">
											<ArrowRight className="size-4" />
										</Button>
									</Link>
								</CardTitle>
							</CardHeader>
							<CardContent className="p-5 pt-2 text-xs text-muted-foreground space-y-3">
								<p>
									Visualise les captures d&apos;écran déposées par les joueurs en litige et attribue
									la victoire ou annule le lobby sans perte de points.
								</p>
								<Link href="/achillea/admins/ranked-disputes" className="block">
									<Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
										Ouvrir la salle des litiges
									</Button>
								</Link>
							</CardContent>
						</Card>

						<Card className="border-border/60">
							<CardHeader className="p-5 pb-2">
								<CardTitle className="text-base flex items-center justify-between">
									<span className="flex items-center gap-2">
										<ShieldAlert className="size-4 text-rose-500" />
										Sanctions & Exclusions
									</span>
									<Link href="/achillea/admins/sanctions">
										<Button variant="ghost" size="sm" className="size-7 p-0">
											<ArrowRight className="size-4" />
										</Button>
									</Link>
								</CardTitle>
							</CardHeader>
							<CardContent className="p-5 pt-2 text-xs text-muted-foreground space-y-3">
								<p>
									Gère les avertissements, exclusions temporaires de ranked et bannissements définitifs
									des joueurs pour infraction aux règles.
								</p>
								<Link href="/achillea/admins/sanctions" className="block">
									<Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
										Gérer les sanctions actives
									</Button>
								</Link>
							</CardContent>
						</Card>

						<Card className="border-border/60">
							<CardHeader className="p-5 pb-2">
								<CardTitle className="text-base flex items-center justify-between">
									<span className="flex items-center gap-2">
										<ShieldCheck className="size-4 text-amber-500" />
										Organisations en Attente
									</span>
									<Link href="/achillea/organizations/validate">
										<Button variant="ghost" size="sm" className="size-7 p-0">
											<ArrowRight className="size-4" />
										</Button>
									</Link>
								</CardTitle>
							</CardHeader>
							<CardContent className="p-5 pt-2 text-xs text-muted-foreground space-y-3">
								<p>
									Examine les demandes d&apos;agrément des associations, clans et collectifs tiers
									souhaitant organiser des tournois officiels.
								</p>
								<Link href="/achillea/organizations/validate" className="block">
									<Button variant="outline" size="sm" className="w-full text-xs gap-1.5">
										Examiner les demandes ({ops?.community?.orgsPending ?? 0})
									</Button>
								</Link>
							</CardContent>
						</Card>
					</div>
				</div>
			)}

			{/* CONTENU ONGLET: LITIGES */}
			{activeTab === "disputes" && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-bold">Litiges de Matchs Classés</h2>
						<Link href="/achillea/admins/ranked-disputes">
							<Button variant="outline" size="sm" className="gap-1.5 text-xs">
								Vue plein écran dédiée
								<ExternalLink className="size-3.5" />
							</Button>
						</Link>
					</div>

					{disputes.length === 0 ? (
						<div className="p-12 text-center border border-border/60 rounded-xl bg-card/40 space-y-2">
							<CheckCircle2 className="size-8 text-emerald-400 mx-auto" />
							<div className="font-semibold text-sm">Aucun litige en cours</div>
							<p className="text-xs text-muted-foreground">
								Tous les scores de matchs classés ont été confirmés ou arbitrés.
							</p>
						</div>
					) : (
						<div className="divide-y divide-border/60 border border-border/60 rounded-xl bg-card/40 overflow-hidden">
							{disputes.map((d) => (
								<div key={d.lobbyId} className="p-4 flex items-center justify-between gap-4">
									<div className="space-y-1">
										<div className="flex items-center gap-2">
											<Badge variant="outline" className="text-rose-400 border-rose-500/30">
												Litige #{d.lobbyId}
											</Badge>
											<span className="text-xs text-muted-foreground">
												Lobby {d.lobbyId} · Signalé le{" "}
												{new Date(d.createdAt).toLocaleDateString("fr-FR")}
											</span>
										</div>
										<p className="text-sm font-medium">
											{d.player1?.displayName ?? "Joueur 1"} vs {d.player2?.displayName ?? "Joueur 2"} — Score contesté
										</p>
									</div>

									<div className="flex items-center gap-2">
										<Link href="/achillea/admins/ranked-disputes">
											<Button size="sm" variant="default" className="text-xs gap-1">
												Arbitrer
												<ArrowRight className="size-3" />
											</Button>
										</Link>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			)}

			{/* CONTENU ONGLET: SANCTIONS */}
			{activeTab === "sanctions" && (
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h2 className="text-lg font-bold">Modération & Sanctions</h2>
						<Link href="/achillea/admins/sanctions">
							<Button variant="outline" size="sm" className="gap-1.5 text-xs">
								Console complète des sanctions
								<ExternalLink className="size-3.5" />
							</Button>
						</Link>
					</div>
					<div className="p-8 text-center border border-border/60 rounded-xl bg-card/40 space-y-3">
						<ShieldAlert className="size-8 text-rose-500 mx-auto" />
						<div className="font-semibold text-sm">Gestion des sanctions centralisée</div>
						<p className="text-xs text-muted-foreground max-w-lg mx-auto">
							La gestion complète des sanctions, suspensions de ladder et levées de bans est
							accessible via la vue dédiée.
						</p>
						<Link href="/achillea/admins/sanctions">
							<Button size="sm" className="mt-2 text-xs">
								Accéder à la console
							</Button>
						</Link>
					</div>
				</div>
			)}

			{/* CONTENU ONGLET: SAISONS */}
			{activeTab === "seasons" && (
				<div className="space-y-4">
					<h2 className="text-lg font-bold">Saisons du Ladder Ranked</h2>
					<div className="p-8 text-center border border-border/60 rounded-xl bg-card/40 space-y-3">
						<Calendar className="size-8 text-primary mx-auto" />
						<div className="font-semibold text-sm">Gestion des Saisons et Formules ELO</div>
						<p className="text-xs text-muted-foreground max-w-lg mx-auto">
							Configuration des facteurs K, des dates d&apos;ouverture/clôture et du soft-reset des points
							classés (AP) entre les saisons.
						</p>
					</div>
				</div>
			)}

			{/* CONTENU ONGLET: UTILISATEURS */}
			{activeTab === "users" && (
				<div className="space-y-4">
					<h2 className="text-lg font-bold">Gestion des Rôles Staff & Joueurs</h2>
					<div className="p-8 text-center border border-border/60 rounded-xl bg-card/40 space-y-3">
						<Users className="size-8 text-sky-400 mx-auto" />
						<div className="font-semibold text-sm">Permissions Staff & Attribution de Rôles</div>
						<p className="text-xs text-muted-foreground max-w-lg mx-auto">
							Recherche de joueurs par pseudo Discord et attribution des permissions Modérateur (1),
							Admin (2) et Super-Admin (3).
						</p>
					</div>
				</div>
			)}

			{/* CONTENU ONGLET: PORTEFEUILLES */}
			{activeTab === "wallets" && (
				<div className="space-y-4">
					<h2 className="text-lg font-bold">Économie & Portefeuilles ACH</h2>
					<div className="p-8 text-center border border-border/60 rounded-xl bg-card/40 space-y-3">
						<Wallet className="size-8 text-amber-500 mx-auto" />
						<div className="font-semibold text-sm">Circulation des Jetons Achilléa (ACH)</div>
						<p className="text-xs text-muted-foreground max-w-lg mx-auto">
							Solde global en circulation, historique des transactions et octroi de primes de tournois.
						</p>
					</div>
				</div>
			)}

			{/* CONTENU ONGLET: BOT & API */}
			{activeTab === "bot" && (
				<div className="space-y-4">
					<h2 className="text-lg font-bold">Statut de l&apos;Infrastructure</h2>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Card className="border-border/60 bg-card/40">
							<CardHeader className="p-5 pb-2">
								<CardTitle className="text-sm font-semibold flex items-center gap-2">
									<Server className="size-4 text-emerald-400" />
									API Achilléa & Base de Données
								</CardTitle>
							</CardHeader>
							{/*
							 * Ces trois indicateurs étaient écrits en dur : « Opérationnel »
							 * et « Connecté » s'affichaient en vert même API morte. Un
							 * tableau de bord qui ment sur l'état du système est pire que
							 * pas de tableau de bord : il retarde le diagnostic.
							 *
							 * Ils sont désormais déduits de `ops` — la réponse même de
							 * l'API. Si elle n'a pas répondu, `ops` est `null` et l'on
							 * affiche « Injoignable », ce qui est la seule chose que l'on
							 * sache alors avec certitude.
							 */}
							<CardContent className="p-5 pt-2 text-xs space-y-2">
								<div className="flex justify-between py-1 border-b border-border/40">
									<span className="text-muted-foreground">Statut API</span>
									{ops ? (
										<span className="text-emerald-400 font-semibold flex items-center gap-1">
											<CheckCircle2 className="size-3" /> Opérationnel
										</span>
									) : (
										<span className="text-destructive font-semibold flex items-center gap-1">
											<XCircle className="size-3" /> Injoignable
										</span>
									)}
								</div>
								<div className="flex justify-between py-1 border-b border-border/40">
									<span className="text-muted-foreground">Dernière mesure</span>
									<span className="font-mono text-[11px]">
										{ops?.generatedAt
											? new Date(ops.generatedAt).toLocaleTimeString("fr-FR")
											: "—"}
									</span>
								</div>
								<div className="flex justify-between py-1">
									<span className="text-muted-foreground">Mode maintenance</span>
									{ops?.bot?.maintenance ? (
										<span className="text-amber-400 font-semibold flex items-center gap-1">
											<AlertTriangle className="size-3" /> Actif
										</span>
									) : (
										<span className="font-semibold">Inactif</span>
									)}
								</div>
							</CardContent>
						</Card>

						<Card className="border-border/60 bg-card/40">
							<CardHeader className="p-5 pb-2">
								<CardTitle className="text-sm font-semibold flex items-center gap-2">
									<Server className="size-4 text-primary" />
									Bot Discord Achilléa
								</CardTitle>
							</CardHeader>
							<CardContent className="p-5 pt-2 text-xs space-y-2">
								{/* `ops.bot.online` était disponible et ignoré : l'état de la
								    passerelle Discord s'affichait « Connecté » en dur. */}
								<div className="flex justify-between py-1 border-b border-border/40">
									<span className="text-muted-foreground">Gateway Discord</span>
									{ops?.bot?.online ? (
										<span className="text-emerald-400 font-semibold flex items-center gap-1">
											<CheckCircle2 className="size-3" /> Connecté
										</span>
									) : (
										<span className="text-destructive font-semibold flex items-center gap-1">
											<XCircle className="size-3" /> Déconnecté
										</span>
									)}
								</div>
								<div className="flex justify-between py-1 border-b border-border/40">
									<span className="text-muted-foreground">Temps de fonctionnement</span>
									<span className="font-mono font-semibold">
										{typeof ops?.bot?.uptime === "number"
											? formaterDuree(ops.bot.uptime)
											: "—"}
									</span>
								</div>
								<div className="flex justify-between py-1">
									<span className="text-muted-foreground">Serveurs surveillés</span>
									<span className="font-mono font-semibold">
										{typeof ops?.bot?.guilds === "number" ? ops.bot.guilds : "—"}
									</span>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>
			)}
		</div>
	);
}
