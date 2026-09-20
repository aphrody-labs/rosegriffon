"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAchilleaAuth, createAchilleaClient } from "@/lib/achillea";
import { UserAvatar } from "@/components/achillea/UserAvatar";
import type { ClanDTO, ClanMemberDTO, ClanApplicationDTO, ClanInviteDTO } from "@rosegriffon/achillea-types";
import {
	Shield,
	Users,
	ArrowLeft,
	ShieldAlert,
	Loader2,
	Check,
	X,
	UserPlus,
	UserMinus,
	Settings,
	Mail,
	UserCheck,
	Save,
} from "lucide-react";

export default function ClanDashboardPage() {
	const { user, isAuthenticated, login } = useAchilleaAuth();

	const [clan, setClan] = useState<ClanDTO | null>(null);
	const [members, setMembers] = useState<ClanMemberDTO[]>([]);
	const [applications, setApplications] = useState<ClanApplicationDTO[]>([]);
	const [invites, setInvites] = useState<ClanInviteDTO[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [activeTab, setActiveTab] = useState<"members" | "applications" | "invites" | "settings">("members");

	// Settings state
	const [bio, setBio] = useState<string>("");
	const [isRecruiting, setIsRecruiting] = useState<boolean>(true);
	const [savingSettings, setSavingSettings] = useState<boolean>(false);
	const [settingsSaved, setSettingsSaved] = useState<boolean>(false);

	useEffect(() => {
		if (!isAuthenticated) {
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		const client = createAchilleaClient({ credentials: "include" });

		// Fetch user clan and data
		client.clans
			.list({ page: 1, pagination: 1 })
			.then(async (res) => {
				if (cancelled) return;
				if (res.ok && res.value.data.length > 0) {
					const myClan = res.value.data[0];
					setClan(myClan);
					setBio(myClan.clanBiography || "");
					setIsRecruiting(myClan.isRecruiting);

					const [memRes, appRes, invRes] = await Promise.all([
						client.clans.members(myClan.id),
						client.clans.applications(),
						client.clans.invites(),
					]);

					if (cancelled) return;
					if (memRes.ok) setMembers(memRes.value);
					if (appRes.ok) setApplications(appRes.value);
					if (invRes.ok) setInvites(invRes.value);
				}
			})
			.catch(() => {})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [isAuthenticated]);

	const handleSaveSettings = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!clan) return;
		setSavingSettings(true);
		const client = createAchilleaClient({ credentials: "include" });
		try {
			const res = await client.clans.update(clan.id, {
				clanBiography: bio,
				isRecruiting,
			});
			if (res.ok) {
				setSettingsSaved(true);
				setTimeout(() => setSettingsSaved(false), 2000);
			}
		} finally {
			setSavingSettings(false);
		}
	};

	const handleKickMember = async (userId: string) => {
		if (!clan) return;
		const client = createAchilleaClient({ credentials: "include" });
		await client.clans.kickMember(userId, "Exclusion par un officier");
		setMembers((prev) => prev.filter((m) => m.user?.id !== userId));
	};

	const handleAcceptApp = async (app: ClanApplicationDTO) => {
		const client = createAchilleaClient({ credentials: "include" });
		await client.clans.acceptApplication(app);
		setApplications((prev) => prev.filter((a) => a.id !== app.id));
	};

	const handleRejectApp = async (app: ClanApplicationDTO) => {
		const client = createAchilleaClient({ credentials: "include" });
		await client.clans.rejectApplication(app);
		setApplications((prev) => prev.filter((a) => a.id !== app.id));
	};

	if (!isAuthenticated) {
		return (
			<div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
				<ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
				<h2 className="text-xl font-bold">Connexion requise</h2>
				<p className="text-sm text-muted-foreground">
					Vous devez être membre ou officier d'un clan pour accéder au tableau de bord.
				</p>
				<button
					type="button"
					onClick={() => login()}
					className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition shadow-sm text-xs"
				>
					Se connecter
				</button>
			</div>
		);
	}

	return (
		<div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
			{/* Breadcrumb */}
			<div className="space-y-1 border-b border-border pb-6">
				<Link
					href="/achillea/clans"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					Retour aux clans
				</Link>
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-2">
						<span className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
							<Shield className="w-5 h-5" />
						</span>
						<div>
							<h1 className="text-3xl font-bold tracking-tight">Gestion du Clan</h1>
							<p className="text-xs text-muted-foreground mt-0.5">
								{clan ? `${clan.name} [${clan.shortenedName}]` : "Tableau de bord de gestion"}
							</p>
						</div>
					</div>

					{clan && (
						<Link
							href={`/achillea/clans/${clan.id}`}
							className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted transition"
						>
							Voir la fiche publique
						</Link>
					)}
				</div>
			</div>

			{/* Tabs */}
			<div className="flex items-center gap-2 border-b border-border pb-px overflow-x-auto">
				<button
					type="button"
					onClick={() => setActiveTab("members")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "members"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<Users className="w-3.5 h-3.5" />
					Membres ({members.length})
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("applications")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "applications"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<UserCheck className="w-3.5 h-3.5" />
					Candidatures ({applications.length})
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("invites")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "invites"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<Mail className="w-3.5 h-3.5" />
					Invitations ({invites.length})
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("settings")}
					className={`px-4 py-2 text-xs font-semibold border-b-2 transition -mb-px flex items-center gap-1.5 ${
						activeTab === "settings"
							? "border-primary text-foreground"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					<Settings className="w-3.5 h-3.5" />
					Paramètres
				</button>
			</div>

			{loading ? (
				<div className="py-20 text-center space-y-3">
					<Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
					<p className="text-sm text-muted-foreground">Chargement des données du clan...</p>
				</div>
			) : (
				<>
					{/* Members Tab */}
					{activeTab === "members" && (
						<div className="border border-border rounded-2xl bg-card overflow-hidden">
							<div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
								<h3 className="font-bold text-xs uppercase text-muted-foreground">
									Effectif du clan
								</h3>
							</div>

							<div className="divide-y divide-border/60">
								{members.map((m) => (
									<div
										key={m.user?.id}
										className="p-3 px-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition"
									>
										<div className="flex items-center gap-3">
											<UserAvatar
												avatar={m.user?.avatar}
												name={m.user?.username || "Membre"}
												className="w-8 h-8"
											/>
											<div>
												<div className="font-semibold text-xs text-foreground">
													{m.user?.username}
												</div>
												<div className="text-[10px] text-muted-foreground">
													Rejoint le {new Date(m.createdAt).toLocaleDateString("fr-FR")}
												</div>
											</div>
										</div>

										<div className="flex items-center gap-2">
											<span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground">
												{m.clanRole === 3
													? "Président"
													: m.clanRole === 2
													? "Vice-Président"
													: "Membre"}
											</span>

											{m.clanRole !== 3 && (
												<button
													type="button"
													onClick={() => m.user?.id && handleKickMember(m.user.id)}
													className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
													title="Exclure du clan"
												>
													<UserMinus className="w-4 h-4" />
												</button>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Applications Tab */}
					{activeTab === "applications" && (
						<div className="border border-border rounded-2xl bg-card overflow-hidden">
							<div className="p-4 border-b border-border bg-muted/20">
								<h3 className="font-bold text-xs uppercase text-muted-foreground">
									Candidatures reçues
								</h3>
							</div>

							{applications.length === 0 ? (
								<div className="py-12 text-center text-xs text-muted-foreground">
									Aucune candidature en attente.
								</div>
							) : (
								<div className="divide-y divide-border/60">
									{applications.map((app) => (
										<div
											key={app.id}
											className="p-4 flex items-center justify-between gap-4 hover:bg-muted/20 transition"
										>
											<div className="flex items-center gap-3">
												<UserAvatar
													avatar={app.user?.avatar}
													displayName={app.user?.username || "Candidat"}
													className="w-8 h-8"
												/>
												<div>
													<div className="font-semibold text-xs">{app.user?.username}</div>
													<div className="text-[10px] text-muted-foreground">
														Postulé le {new Date(app.createdAt).toLocaleDateString("fr-FR")}
													</div>
												</div>
											</div>

											<div className="flex items-center gap-2">
												<button
													type="button"
													onClick={() => handleAcceptApp(app)}
													className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition"
												>
													<Check className="w-3.5 h-3.5" />
													Accepter
												</button>
												<button
													type="button"
													onClick={() => handleRejectApp(app)}
													className="inline-flex items-center gap-1 px-3 py-1 border border-border hover:bg-muted text-muted-foreground rounded-lg text-xs font-semibold transition"
												>
													<X className="w-3.5 h-3.5" />
													Refuser
												</button>
											</div>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* Invites Tab */}
					{activeTab === "invites" && (
						<div className="border border-border rounded-2xl bg-card overflow-hidden">
							<div className="p-4 border-b border-border bg-muted/20">
								<h3 className="font-bold text-xs uppercase text-muted-foreground">
									Invitations envoyées
								</h3>
							</div>

							{invites.length === 0 ? (
								<div className="py-12 text-center text-xs text-muted-foreground">
									Aucune invitation en cours.
								</div>
							) : (
								<div className="divide-y divide-border/60">
									{invites.map((inv) => (
										<div
											key={inv.id}
											className="p-4 flex items-center justify-between gap-4"
										>
											<div className="flex items-center gap-3">
												<UserAvatar
													avatar={inv.user?.avatar}
													displayName={inv.user?.username || "Invité"}
													className="w-8 h-8"
												/>
												<div className="font-semibold text-xs">{inv.user?.username}</div>
											</div>

											<span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
												En attente de réponse
											</span>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* Settings Tab */}
					{activeTab === "settings" && (
						<form onSubmit={handleSaveSettings} className="border border-border bg-card rounded-2xl p-6 space-y-5">
							<h3 className="font-bold text-sm">Paramètres du Clan</h3>

							<div className="space-y-4">
								<div className="space-y-1.5">
									<label className="text-xs font-semibold text-muted-foreground">
										Biographie et présentation
									</label>
									<textarea
										rows={4}
										value={bio}
										onChange={(e) => setBio(e.target.value)}
										className="w-full p-3 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
									/>
								</div>

								<div className="flex items-center gap-3 pt-2">
									<input
										type="checkbox"
										id="recruiting-toggle"
										checked={isRecruiting}
										onChange={(e) => setIsRecruiting(e.target.checked)}
										className="rounded border-border"
									/>
									<label htmlFor="recruiting-toggle" className="text-xs font-medium cursor-pointer">
										Activer le recrutement public (apparaît comme [Recrute] sur l'annuaire)
									</label>
								</div>
							</div>

							<div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
								{settingsSaved && (
									<span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
										<Check className="w-3.5 h-3.5" />
										Enregistré !
									</span>
								)}
								<button
									type="submit"
									disabled={savingSettings}
									className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition shadow-sm"
								>
									{savingSettings ? (
										<Loader2 className="w-3.5 h-3.5 animate-spin" />
									) : (
										<Save className="w-3.5 h-3.5" />
									)}
									Enregistrer les modifications
								</button>
							</div>
						</form>
					)}
				</>
			)}
		</div>
	);
}
