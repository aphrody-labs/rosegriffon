"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRankedMatch } from "@/lib/achillea/use-ranked-match";
import { useAchilleaAuth, createAchilleaClient } from "@/lib/achillea";
import { UserAvatar } from "@/components/achillea/UserAvatar";
import {
	Swords,
	ArrowLeft,
	ShieldCheck,
	ShieldAlert,
	AlertTriangle,
	Send,
	Upload,
	Check,
	Loader2,
	MessageSquare,
	Flag,
	HelpCircle,
} from "lucide-react";

export default function RankedMatchPage() {
	const { user, status, login } = useAchilleaAuth();

	// État RÉEL du match, poussé par le serveur (Colyseus). Tout ce qui suivait
	// ici était inventé : code de salon, mode, adversaire, ELO, chat local,
	// soumission en `setTimeout`. Rien n'atteignait le serveur.
	const parametres = useSearchParams();
	const match = useRankedMatch(parametres.get("salle"));

	const roomCode = match.codeSalle;
	const matchMode = `${match.joueurs.length === 4 ? "2v2" : "1v1"} ${match.classe ? "Classé" : "Amical"}`;

	// Le joueur courant et son adversaire sortent de l'état du serveur, jamais
	// d'une valeur de repli : afficher « Adversaire_99 » à la place d'un nom
	// manquant rend une page crédible qui ne décrit rien.
	const moi = match.joueurs.find((joueur) => joueur.userId === user?.id) ?? null;
	const adversaire = match.joueurs.find((joueur) => joueur.userId !== user?.id) ?? null;

	const [myScore, setMyScore] = useState<number>(0);
	const [oppScore, setOppScore] = useState<number>(0);
	const scoreSubmitted = moi?.submitted ?? false;
	const proofUploaded = moi?.proofUploaded ?? false;

	const [disputeOpen, setDisputeOpen] = useState<boolean>(false);
	const [disputeReason, setDisputeReason] = useState<string>("");
	const [chatInput, setChatInput] = useState<string>("");

	// Les scores saisis suivent ceux que le serveur a déjà enregistrés : après
	// un rechargement, le formulaire reflète l'état réel au lieu de repartir de
	// zéro et de laisser croire que rien n'a été soumis.
	useEffect(() => {
		if (!moi) return;
		setMyScore(moi.myScore);
		setOppScore(moi.oppScore);
	}, [moi?.myScore, moi?.oppScore]);

	const handleSendChat = (e: React.FormEvent) => {
		e.preventDefault();
		match.envoyerMessage(chatInput);
		setChatInput("");
	};

	const handleSubmitScore = () => {
		match.soumettreScore(myScore, oppScore);
	};

	const handleUploadProof = () => {
		match.signalerPreuve();
	};

	return (
		<div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
			{/* Top breadcrumb & match status */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
				<div className="space-y-1">
					<Link
						href="/achillea/ranked"
						className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-1"
					>
						<ArrowLeft className="w-3.5 h-3.5" />
						Retour au hub classé
					</Link>
					<div className="flex items-center gap-3">
						<span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
							<Swords className="w-5 h-5" />
						</span>
						<div>
							<h1 className="text-2xl font-bold tracking-tight">Match en direct</h1>
							<div className="flex items-center gap-2 mt-0.5">
								<span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
									CODE : {roomCode}
								</span>
								<span className="text-xs text-amber-400 font-semibold">{matchMode}</span>
							</div>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
						<span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
						En cours de jeu
					</span>
				</div>
			</div>

			{/* Match Versus Card */}
			<div className="border border-border bg-card rounded-2xl p-6 shadow-sm">
				<div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6 text-center">
					{/* Home Player (Me) */}
					<div className="flex flex-col items-center space-y-3 p-4 rounded-xl bg-background/50 border border-border">
						<span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
							Domicile (Toi)
						</span>
						<UserAvatar
							avatar={user?.avatar}
							displayName={user?.username ?? "Joueur"}
							className="w-16 h-16 ring-2 ring-primary"
						/>
						<div>
							<div className="font-bold text-sm">{moi?.displayName || user?.username || "—"}</div>
							<div className="text-xs text-[var(--achillea-lime)] font-mono mt-0.5">
								{moi ? `${moi.elo} AP` : "—"}
							</div>
						</div>
					</div>

					{/* Center VS & Current reported score */}
					<div className="space-y-3">
						<div className="text-3xl font-black tracking-widest text-muted-foreground/60">VS</div>
						<div className="font-mono text-4xl font-extrabold text-foreground tracking-tight bg-background border border-border/80 py-2 px-6 rounded-2xl inline-block shadow-inner">
							{myScore} - {oppScore}
						</div>
						<div className="text-xs text-muted-foreground">{matchMode}</div>
					</div>

					{/* Away Player (Opponent) */}
					<div className="flex flex-col items-center space-y-3 p-4 rounded-xl bg-background/50 border border-border">
						<span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
							Extérieur (Adversaire)
						</span>
						<UserAvatar
							avatar={adversaire?.avatar ?? ""}
							displayName={adversaire?.displayName ?? "En attente"}
							className="w-16 h-16 ring-2 ring-border"
						/>
						<div>
							<div className="font-bold text-sm">
								{adversaire?.displayName ?? "En attente d'un adversaire"}
							</div>
							<div className="text-xs text-[var(--achillea-lime)] font-mono mt-0.5">
								{adversaire ? `${adversaire.elo} AP` : "—"}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Score submission or Confirmation */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* Left: Score Reporting */}
				<div className="border border-border bg-card rounded-2xl p-6 space-y-5">
					<div className="space-y-1">
						<h3 className="font-bold text-base flex items-center gap-2">
							<ShieldCheck className="w-4 h-4 text-primary" />
							Déclaration du Score
						</h3>
						<p className="text-xs text-muted-foreground">
							Indiquez le score final de la rencontre une fois le coup de sifflet final retenti.
						</p>
					</div>

					{!scoreSubmitted ? (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<label className="text-xs font-semibold text-muted-foreground">
										Mes buts marqués
									</label>
									<input
										type="number"
										min={0}
										max={99}
										value={myScore}
										onChange={(e) => setMyScore(Number(e.target.value))}
										className="w-full p-2.5 rounded-lg border border-border bg-background text-center font-mono font-bold text-lg"
									/>
								</div>
								<div className="space-y-1.5">
									<label className="text-xs font-semibold text-muted-foreground">
										Buts adverses
									</label>
									<input
										type="number"
										min={0}
										max={99}
										value={oppScore}
										onChange={(e) => setOppScore(Number(e.target.value))}
										className="w-full p-2.5 rounded-lg border border-border bg-background text-center font-mono font-bold text-lg"
									/>
								</div>
							</div>

							<button
								type="button"
								onClick={handleSubmitScore}
								disabled={match.connexion !== "connecte"}
								className="w-full py-3 px-4 bg-primary text-primary-foreground font-bold text-sm rounded-xl hover:bg-primary/90 transition shadow-sm flex items-center justify-center gap-2"
							>
								{match.connexion === "connexion" ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									<Check className="w-4 h-4" />
								)}
								Confirmer et envoyer le score
							</button>

							<div className="flex items-center justify-between text-xs pt-2">
								<button
									type="button"
									onClick={() => setDisputeOpen(!disputeOpen)}
									className="text-amber-400 hover:underline flex items-center gap-1"
								>
									<AlertTriangle className="w-3.5 h-3.5" />
									Signaler un litige / problème
								</button>
								<button
									type="button"
									className="text-muted-foreground hover:text-destructive flex items-center gap-1"
								>
									<Flag className="w-3.5 h-3.5" />
									Déclarer forfait
								</button>
							</div>
						</div>
					) : (
						<div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
							<Check className="w-8 h-8 text-emerald-400 mx-auto" />
							<div className="font-bold text-sm text-emerald-400">Score soumis avec succès !</div>
							<p className="text-xs text-muted-foreground">
								En attente de validation par l'adversaire. La mise à jour de vos AP sera appliquée instantanément.
							</p>
						</div>
					)}

					{/* Dispute block */}
					{disputeOpen && (
						<div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 text-xs">
							<div className="font-bold text-amber-400 flex items-center gap-1.5">
								<AlertTriangle className="w-4 h-4" />
								Ouverture d'un litige
							</div>
							<p className="text-muted-foreground">
								En cas de déconnexion volontaire, triche ou désaccord sur le score, téléchargez une capture d'écran du résultat final pour l'arbitre Achilléa.
							</p>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleUploadProof}
									className="py-1.5 px-3 rounded-lg border border-border bg-background hover:bg-muted font-medium flex items-center gap-1.5"
								>
									<Upload className="w-3.5 h-3.5" />
									{proofUploaded ? "Capture déposée !" : "Télécharger une capture"}
								</button>
							</div>
						</div>
					)}
				</div>

				{/* Right: In-room Chat */}
				<div className="border border-border bg-card rounded-2xl p-6 flex flex-col justify-between space-y-4 h-80">
					<div className="flex items-center justify-between border-b border-border pb-3">
						<div className="flex items-center gap-2">
							<MessageSquare className="w-4 h-4 text-primary" />
							<h3 className="font-bold text-sm">Salon de discussion</h3>
						</div>
						<span className="text-[11px] text-muted-foreground">Match Room</span>
					</div>

					{/* Messages scroll */}
					<div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs">
						{match.messages.length === 0 ? (
							<p className="py-4 text-center text-muted-foreground">Aucun message.</p>
						) : (
							match.messages.map((m, idx) => {
								// L'auteur est résolu depuis les joueurs du match : le serveur
								// n'envoie qu'un identifiant, et afficher cet identifiant brut
								// dans une conversation ne veut rien dire pour un joueur.
								const auteur =
									match.joueurs.find((joueur) => joueur.userId === m.userId)?.displayName ??
									(m.userId ? "Joueur" : "Système");
								return (
									<div
										key={`${m.userId}-${m.at}-${idx}`}
										className="p-2 rounded-lg bg-background/80 border border-border/60 space-y-0.5"
									>
										<div className="flex items-center justify-between text-[10px] text-muted-foreground">
											<span className="font-semibold text-foreground">{auteur}</span>
											<span>
												{new Date(m.at).toLocaleTimeString("fr-FR", {
													hour: "2-digit",
													minute: "2-digit",
												})}
											</span>
										</div>
										<p className="text-muted-foreground leading-relaxed">{m.text}</p>
									</div>
								);
							})
						)}
					</div>

					{/* Input form */}
					<form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2 border-t border-border">
						<input
							type="text"
							placeholder="Écrire un message..."
							value={chatInput}
							onChange={(e) => setChatInput(e.target.value)}
							className="flex-1 px-3 py-1.5 text-xs bg-background border border-border rounded-lg placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
						<button
							type="submit"
							className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
						>
							<Send className="w-3.5 h-3.5" />
						</button>
					</form>
				</div>
			</div>
		</div>
	);
}
