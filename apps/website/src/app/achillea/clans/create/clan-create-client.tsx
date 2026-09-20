"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAchilleaClient, useAchilleaAuth } from "@/lib/achillea";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
} from "@rosegriffon/ui";
import { ArrowLeft, Plus, Shield, Users, Check, AlertCircle } from "lucide-react";

export default function CreateClanPage() {
	const router = useRouter();
	const { isAuthenticated, login } = useAchilleaAuth();

	const [name, setName] = useState("");
	const [tag, setTag] = useState("");
	const [biography, setBiography] = useState("");
	const [languages, setLanguages] = useState(["fr"]);
	const [founderIds, setFounderIds] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isAuthenticated) {
			login("/achillea/clans/create");
			return;
		}

		if (name.trim().length < 3 || name.trim().length > 30) {
			setError("Le nom du clan doit comporter entre 3 et 30 caractères.");
			return;
		}
		if (tag.trim().length < 2 || tag.trim().length > 4) {
			setError("Le sigle (tag) du clan doit comporter entre 2 et 4 caractères.");
			return;
		}

		setSubmitting(true);
		setError(null);

		try {
			const client = createAchilleaClient({ credentials: "include" });
			const parsedFounders = founderIds
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean);

			const res = await client.clans.create({
				name: name.trim(),
				shortenedName: tag.trim().toUpperCase(),
				clanBiography: biography.trim(),
				languages,
			});

			if (res.ok) {
				if (res.value.clanId) {
					router.push(`/achillea/clans/${res.value.clanId}`);
				} else {
					router.push("/achillea/clans");
				}
			} else {
				setError(res.detail || "Impossible de créer le clan.");
			}
		} catch {
			setError("Une erreur inattendue est survenue.");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
			<Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2 text-on-surface-variant">
				<Link href="/achillea/clans">
					<ArrowLeft className="size-4" />
					Tous les clans
				</Link>
			</Button>

			<Card className="rounded-3xl border-outline/20 shadow-xl overflow-hidden">
				<CardHeader className="space-y-1 bg-surface-variant/20 p-6 sm:p-8 border-b border-outline/10">
					<div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold mb-2">
						<Shield className="size-6" />
					</div>
					<CardTitle className="text-2xl font-black">Fonder un clan officiel</CardTitle>
					<CardDescription className="text-sm text-on-surface-variant">
						Remplis les informations fondamentales de ton équipe compétitive.
					</CardDescription>
				</CardHeader>

				<CardContent className="p-6 sm:p-8">
					{error && (
						<div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-sm flex items-center gap-2">
							<AlertCircle className="size-4 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-5">
						<div className="space-y-1.5">
							<label className="text-xs font-bold text-on-surface uppercase tracking-wider">
								Nom du clan <span className="text-red-500">*</span>
							</label>
							<input
								type="text"
								required
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="ex. Raimon Eleven"
								className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-variant/20 text-sm text-on-surface focus:outline-none focus:border-primary"
							/>
							<p className="text-[11px] text-on-surface-variant">Entre 3 et 30 caractères.</p>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-bold text-on-surface uppercase tracking-wider">
								Sigle / Tag court <span className="text-red-500">*</span>
							</label>
							<input
								type="text"
								required
								maxLength={4}
								value={tag}
								onChange={(e) => setTag(e.target.value.toUpperCase())}
								placeholder="ex. RG"
								className="w-full max-w-xs px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-variant/20 text-sm text-on-surface uppercase font-mono font-bold focus:outline-none focus:border-primary"
							/>
							<p className="text-[11px] text-on-surface-variant">2 à 4 lettres majuscules (ex. RG, INA).</p>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-bold text-on-surface uppercase tracking-wider">
								Biographie & Présentation
							</label>
							<textarea
								rows={4}
								value={biography}
								onChange={(e) => setBiography(e.target.value)}
								placeholder="Présentation du clan, ambitions esport, critères de sélection..."
								className="w-full p-3 rounded-xl border border-outline/30 bg-surface-variant/20 text-sm text-on-surface focus:outline-none focus:border-primary"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-bold text-on-surface uppercase tracking-wider">
								Identifiants des co-fondateurs (Discord IDs)
							</label>
							<input
								type="text"
								value={founderIds}
								onChange={(e) => setFounderIds(e.target.value)}
								placeholder="ID1, ID2, ID3..."
								className="w-full px-3.5 py-2.5 rounded-xl border border-outline/30 bg-surface-variant/20 text-sm text-on-surface focus:outline-none focus:border-primary"
							/>
							<p className="text-[11px] text-on-surface-variant">
								Optionnel : sépare les IDs Discord par des virgules pour lancer le vote de fondation.
							</p>
						</div>

						<div className="pt-4 flex justify-end gap-3">
							<Button asChild variant="outline">
								<Link href="/achillea/clans">Annuler</Link>
							</Button>
							<Button type="submit" disabled={submitting} className="font-bold">
								{submitting ? "Création en cours..." : "Valider et créer le clan"}
							</Button>
						</div>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
