"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAchilleaAuth, createAchilleaClient } from "@/lib/achillea";
import { StageType, MatchFormat } from "@rosegriffon/achillea-types/enums/eventEnums";
import {
	Trophy,
	ArrowLeft,
	ShieldAlert,
	Loader2,
	Check,
	Sparkles,
	Calendar,
	Users,
	FileText,
} from "lucide-react";

export default function TournamentCreationPage() {
	const router = useRouter();
	const { user, isAuthenticated, login } = useAchilleaAuth();

	const [name, setName] = useState<string>("");
	const [description, setDescription] = useState<string>("");
	const [stageType, setStageType] = useState<StageType>(StageType.single_elimination);
	const [capacity, setCapacity] = useState<number>(32);
	const [startDate, setStartDate] = useState<string>("");

	const [submitting, setSubmitting] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) {
			setError("Veuillez renseigner un nom de tournoi.");
			return;
		}

		setError(null);
		setSubmitting(true);
		const client = createAchilleaClient({ credentials: "include" });

		try {
			const starts = startDate ? new Date(startDate) : new Date(Date.now() + 86400000 * 7);
			const grandFinal = new Date(starts.getTime() + 7200000);

			const res = await client.tournaments.create({
				name: name.trim(),
				description: description.trim() || "Tournoi officiel Achilléa.",
				tournamentType: stageType,
				participantsNumber: capacity,
				matchFormat: MatchFormat.BO1,
				organization: 1, // Default organization
				managers: [],
				seedOrdering: "natural",
				groupStageEnabled: false,
				affiche: "",
				logo: "",
				ruleset: "",
				planning: "",
				startsAt: starts,
				grandFinalAt: grandFinal,
			});

			if (res.ok && res.value) {
				const created = res.value as any;
				const id = created.id ?? created.tournament?.id;
				if (id) {
					router.push(`/achillea/tournaments/${id}`);
				} else {
					router.push("/achillea/tournaments");
				}
			} else {
				setError("Impossible de créer le tournoi. Droits administrateur ou organisateur requis.");
			}
		} catch {
			setError("Une erreur inattendue est survenue.");
		} finally {
			setSubmitting(false);
		}
	};

	if (!isAuthenticated) {
		return (
			<div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
				<ShieldAlert className="w-12 h-12 text-amber-500 mx-auto" />
				<h2 className="text-xl font-bold">Connexion requise</h2>
				<p className="text-sm text-muted-foreground">
					Vous devez être connecté avec un compte organisateur pour créer un tournoi.
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
		<div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
			{/* Header */}
			<div className="space-y-1 border-b border-border pb-6">
				<Link
					href="/achillea/tournaments"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					Retour aux tournois
				</Link>
				<div className="flex items-center gap-2">
					<span className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
						<Trophy className="w-5 h-5" />
					</span>
					<h1 className="text-3xl font-bold tracking-tight">Créer un Tournoi</h1>
				</div>
				<p className="text-sm text-muted-foreground">
					Configurez un nouveau tournoi officiel ou communautaire sur Inazuma Eleven: Victory Road.
				</p>
			</div>

			{/* Form */}
			<form onSubmit={handleSubmit} className="border border-border bg-card rounded-2xl p-6 md:p-8 space-y-6">
				{error && (
					<div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold">
						{error}
					</div>
				)}

				<div className="space-y-4">
					{/* Tournament Name */}
					<div className="space-y-1.5">
						<label className="text-xs font-bold text-foreground flex items-center gap-1.5">
							<Trophy className="w-3.5 h-3.5 text-primary" />
							Nom du tournoi *
						</label>
						<input
							type="text"
							placeholder="Ex: Coupe d'Ilion - Édition #4"
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							required
						/>
					</div>

					{/* Description & Rules */}
					<div className="space-y-1.5">
						<label className="text-xs font-bold text-foreground flex items-center gap-1.5">
							<FileText className="w-3.5 h-3.5 text-primary" />
							Règles et description
						</label>
						<textarea
							rows={4}
							placeholder="Précisez le règlement, les restrictions d'équipe, etc."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					{/* Format and Capacity */}
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<label className="text-xs font-bold text-foreground flex items-center gap-1.5">
								<Sparkles className="w-3.5 h-3.5 text-primary" />
								Type d'arbre / Format
							</label>
							<select
								value={stageType}
								onChange={(e) => setStageType(e.target.value as StageType)}
								className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value={StageType.single_elimination}>Élimination directe (Single)</option>
								<option value={StageType.double_elimination}>Double élimination</option>
								<option value={StageType.round_robin}>Toutes rondes (Round Robin)</option>
								<option value={StageType.league}>Championnat (Ligue)</option>
							</select>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-bold text-foreground flex items-center gap-1.5">
								<Users className="w-3.5 h-3.5 text-primary" />
								Capacité max de joueurs
							</label>
							<select
								value={capacity}
								onChange={(e) => setCapacity(Number(e.target.value))}
								className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value={8}>8 joueurs</option>
								<option value={16}>16 joueurs</option>
								<option value={32}>32 joueurs</option>
								<option value={64}>64 joueurs</option>
								<option value={128}>128 joueurs</option>
							</select>
						</div>
					</div>

					{/* Start date */}
					<div className="space-y-1.5">
						<label className="text-xs font-bold text-foreground flex items-center gap-1.5">
							<Calendar className="w-3.5 h-3.5 text-primary" />
							Date et heure de début
						</label>
						<input
							type="datetime-local"
							value={startDate}
							onChange={(e) => setStartDate(e.target.value)}
							className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>
				</div>

				<div className="pt-4 border-t border-border flex items-center justify-end gap-3">
					<Link
						href="/achillea/tournaments"
						className="px-4 py-2 text-xs font-semibold rounded-xl border border-border bg-background hover:bg-muted transition"
					>
						Annuler
					</Link>
					<button
						type="submit"
						disabled={submitting}
						className="inline-flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl hover:bg-primary/90 transition shadow-sm"
					>
						{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
						Créer et planifier le tournoi
					</button>
				</div>
			</form>
		</div>
	);
}
