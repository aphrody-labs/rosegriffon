"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAchilleaAuth, createAchilleaClient } from "@/lib/achillea";
import { SocialMedia } from "@rosegriffon/achillea-types/domain/common";
import {
	Building2,
	ArrowLeft,
	ShieldAlert,
	Loader2,
	Check,
	Globe,
	FileText,
	Image as ImageIcon,
} from "lucide-react";

export default function OrganizationCreationPage() {
	const router = useRouter();
	const { user, isAuthenticated, login } = useAchilleaAuth();

	const [name, setName] = useState<string>("");
	const [description, setDescription] = useState<string>("");
	const [logo, setLogo] = useState<string>("");
	const [origin, setOrigin] = useState<string>("FR");
	const [twitter, setTwitter] = useState<string>("");

	const [submitting, setSubmitting] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) {
			setError("Veuillez renseigner le nom de votre organisation.");
			return;
		}

		setError(null);
		setSubmitting(true);
		const client = createAchilleaClient({ credentials: "include" });

		try {
			const res = await client.organizations.create({
				name: name.trim(),
				normalizedName: name.trim().toLowerCase().replace(/\s+/g, "-"),
				description: description.trim() || "Organisation esport Achilléa.",
				logo: logo.trim() || "https://rosegriffon.fr/achillea/achillea.png",
				origin: origin as any,
				owner: user as any,
				orgManagers: [],
				socialMedias: twitter
					? [{ platform: SocialMedia.X, username: twitter, canonicalUrl: `https://x.com/${twitter}` }]
					: [],
				broadcastMedias: [],
			});

			if (res.ok) {
				router.push("/achillea/tournaments");
			} else {
				setError(res.detail || "Impossible de soumettre la demande d'organisation.");
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
					Connectez-vous pour enregistrer votre organisation esport officielle.
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
		<div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
			{/* Breadcrumb */}
			<div className="space-y-1 border-b border-border pb-6">
				<Link
					href="/achillea"
					className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2"
				>
					<ArrowLeft className="w-3.5 h-3.5" />
					Retour au hub Achilléa
				</Link>
				<div className="flex items-center gap-2">
					<span className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
						<Building2 className="w-5 h-5" />
					</span>
					<h1 className="text-3xl font-bold tracking-tight">Déclarer une Organisation</h1>
				</div>
				<p className="text-sm text-muted-foreground">
					Enregistrez votre structure pour organiser des tournois officiels et engager des équipes en championnat.
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
					<div className="space-y-1.5">
						<label className="text-xs font-bold text-foreground">
							Nom de la structure *
						</label>
						<input
							type="text"
							placeholder="Ex: Solary, Vitality, Chrono Storm..."
							value={name}
							onChange={(e) => setName(e.target.value)}
							className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							required
						/>
					</div>

					<div className="space-y-1.5">
						<label className="text-xs font-bold text-foreground">
							Description & Présentation
						</label>
						<textarea
							rows={3}
							placeholder="Présentez brièvement la structure..."
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div className="space-y-1.5">
						<label className="text-xs font-bold text-foreground">
							URL du Logo (PNG ou WebP)
						</label>
						<input
							type="url"
							placeholder="https://..."
							value={logo}
							onChange={(e) => setLogo(e.target.value)}
							className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
						/>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<label className="text-xs font-bold text-foreground">
								Pays d'origine
							</label>
							<select
								value={origin}
								onChange={(e) => setOrigin(e.target.value)}
								className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
							>
								<option value="FR">France (FR)</option>
								<option value="EN">Royaume-Uni (EN)</option>
								<option value="JP">Japon (JP)</option>
								<option value="DE">Allemagne (DE)</option>
								<option value="IT">Italie (IT)</option>
								<option value="SP">Espagne (SP)</option>
								<option value="PT">Portugal (PT)</option>
							</select>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-bold text-foreground">
								Compte X (Twitter)
							</label>
							<input
								type="text"
								placeholder="@Structure"
								value={twitter}
								onChange={(e) => setTwitter(e.target.value)}
								className="w-full px-3.5 py-2.5 text-sm bg-background border border-border rounded-xl placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
							/>
						</div>
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
						Déposer la demande
					</button>
				</div>
			</form>
		</div>
	);
}
