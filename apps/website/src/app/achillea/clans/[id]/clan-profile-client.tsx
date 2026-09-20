"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createAchilleaClient, useAchilleaAuth } from "@/lib/achillea";
import type { ClanDTO, ClanMemberDTO } from "@rosegriffon/achillea-types";
import { ClanMemberDistinction } from "@rosegriffon/achillea-types/enums/clanMemberRole";
import { UserAvatar } from "@/components/achillea/UserAvatar";
import {
	Badge,
	Button,
	Card,
	CardContent,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Skeleton,
} from "@rosegriffon/ui";
import {
	Crown,
	Users,
	ArrowLeft,
	Globe,
	Check,
	X,
	Calendar,
	Sparkles,
	ShieldAlert,
	MessageSquare,
} from "lucide-react";
import { FaXTwitter, FaTiktok, FaInstagram, FaTwitch } from "react-icons/fa6";

export default function ClanProfilePage({ id }: { id: string }) {
	const clanId = parseInt(id, 10);
	const { user, isAuthenticated } = useAchilleaAuth();

	const [clan, setClan] = useState<ClanDTO | null>(null);
	const [members, setMembers] = useState<ClanMemberDTO[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const [applicationOpen, setApplicationOpen] = useState(false);
	const [applicationMsg, setApplicationMsg] = useState("");
	const [applying, setApplying] = useState(false);
	const [applicationSuccess, setApplicationSuccess] = useState(false);

	useEffect(() => {
		let isMounted = true;
		async function loadClan() {
			if (isNaN(clanId)) {
				setError("Identifiant de clan invalide");
				setLoading(false);
				return;
			}
			setLoading(true);
			try {
				const client = createAchilleaClient();
				const [clanRes, membersRes] = await Promise.all([
					client.clans.get(clanId),
					client.clans.members(clanId),
				]);

				if (!isMounted) return;

				if (clanRes.ok) {
					setClan(clanRes.value);
				} else {
					setError("Clan introuvable");
				}

				if (membersRes.ok) {
					setMembers(membersRes.value);
				}
			} catch {
				if (isMounted) setError("Erreur lors du chargement du clan");
			} finally {
				if (isMounted) setLoading(false);
			}
		}
		void loadClan();
		return () => {
			isMounted = false;
		};
	}, [clanId]);

	const handleApply = async () => {
		if (!isAuthenticated) {
			window.location.href = `/achillea/auth?returnUrl=/achillea/clans/${clanId}`;
			return;
		}
		setApplying(true);
		try {
			const client = createAchilleaClient({ credentials: "include" });
			const res = await client.clans.createApplication(clanId, [ClanMemberDistinction.Player]);
			if (res.ok) {
				setApplicationSuccess(true);
				setTimeout(() => setApplicationOpen(false), 2000);
			}
		} finally {
			setApplying(false);
		}
	};

	if (loading) {
		return (
			<div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
				<Skeleton className="h-8 w-40 rounded-xl" />
				<Skeleton className="h-64 w-full rounded-3xl" />
				<Skeleton className="h-96 w-full rounded-3xl" />
			</div>
		);
	}

	if (error || !clan) {
		return (
			<div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
				<ShieldAlert className="size-12 mx-auto text-amber-500" />
				<h2 className="text-xl font-bold text-on-surface">{error ?? "Clan introuvable"}</h2>
				<Button asChild variant="outline">
					<Link href="/achillea/clans">
						<ArrowLeft className="size-4 mr-2" />
						Retour à la liste des clans
					</Link>
				</Button>
			</div>
		);
	}

	// Classement des membres par rôle hiérarchique
	const roleWeights: Record<number, number> = {
		3: 0, // Président
		2: 1, // Vice-Président
		1: 2, // Membre
		0: 3, // À l'essai
	};
	const sortedMembers = [...members].sort(
		(a, b) => (roleWeights[a.clanRole as unknown as number] ?? 9) - (roleWeights[b.clanRole as unknown as number] ?? 9)
	);

	const roleLabel = (r: number) => {
		switch (r) {
			case 3:
				return "Président";
			case 2:
				return "Vice-Président";
			case 1:
				return "Membre";
			case 0:
				return "À l'essai";
			default:
				return "Membre";
		}
	};

	const roleBadgeVariant = (r: number) => {
		switch (r) {
			case 3:
				return "destructive" as const;
			case 2:
				return "default" as const;
			case 1:
				return "secondary" as const;
			default:
				return "outline" as const;
		}
	};

	return (
		<div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
			{/* Back button */}
			<Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2 text-on-surface-variant">
				<Link href="/achillea/clans">
					<ArrowLeft className="size-4" />
					Tous les clans
				</Link>
			</Button>

			{/* Banner & Header Card */}
			<div className="rounded-3xl border border-outline/20 bg-surface overflow-hidden shadow-xl">
				{/* Clan Banner Image */}
				<div className="relative h-44 sm:h-64 w-full bg-surface-variant">
					{clan.clanAvatarUrl ? (
						<Image
							src={clan.clanAvatarUrl}
							alt={`Avatar ${clan.name}`}
							fill
							unoptimized
							className="object-cover"
						/>
					) : (
						<div className="size-full bg-gradient-to-br from-[#6d00ce]/30 to-[#DFFF57]/20 flex items-center justify-center opacity-70" />
					)}
					<div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
				</div>

				{/* Header Info */}
				<div className="relative px-6 pb-6 pt-0 sm:px-8 sm:pb-8 flex flex-col sm:flex-row gap-6 items-start sm:items-end -mt-16 sm:-mt-20">
					{/* Logo */}
					<div className="relative size-28 sm:size-36 rounded-2xl overflow-hidden border-4 border-surface bg-surface-variant shrink-0 shadow-2xl">
						{clan.clanAvatarUrl ? (
							<Image
								src={clan.clanAvatarUrl}
								alt={clan.name}
								fill
								unoptimized
								className="object-cover"
							/>
						) : (
							<div className="size-full flex items-center justify-center font-black text-3xl text-on-surface-variant">
								{clan.shortenedName}
							</div>
						)}
					</div>

					{/* Meta */}
					<div className="flex-1 min-w-0 space-y-2">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-2xl sm:text-3xl font-black text-on-surface">
								<span className="text-primary mr-2">[{clan.shortenedName}]</span>
								{clan.name}
							</h1>
							<Badge className="font-bold text-xs">
								Niveau {clan.experience?.currentLevel ?? 1}
							</Badge>
						</div>

						<div className="flex flex-wrap items-center gap-4 text-xs text-on-surface-variant">
							<div className="flex items-center gap-1.5">
								<Crown className="size-3.5 text-amber-500" />
								<span>Président : <strong>{clan.president?.username ?? "Inconnu"}</strong></span>
							</div>
							<div className="flex items-center gap-1.5">
								<Users className="size-3.5 text-primary" />
								<span>{members.length} membres</span>
							</div>
							<div className="flex items-center gap-1.5">
								<Calendar className="size-3.5" />
								<span>Fondé le {new Date(clan.createdAt).toLocaleDateString("fr-FR")}</span>
							</div>
						</div>
					</div>

					{/* Actions & Socials */}
					<div className="flex flex-col sm:items-end gap-3 self-stretch sm:self-auto shrink-0">
						<div className="flex items-center gap-2">
							{clan.xUrl && (
								<Button asChild variant="outline" size="icon" className="rounded-xl size-8">
									<a href={clan.xUrl} target="_blank" rel="noopener noreferrer">
										<FaXTwitter className="size-3.5" />
									</a>
								</Button>
							)}
							{clan.instagramUrl && (
								<Button asChild variant="outline" size="icon" className="rounded-xl size-8">
									<a href={clan.instagramUrl} target="_blank" rel="noopener noreferrer">
										<FaInstagram className="size-3.5" />
									</a>
								</Button>
							)}
							{clan.tiktokUrl && (
								<Button asChild variant="outline" size="icon" className="rounded-xl size-8">
									<a href={clan.tiktokUrl} target="_blank" rel="noopener noreferrer">
										<FaTiktok className="size-3.5" />
									</a>
								</Button>
							)}
						</div>

						{clan.isRecruiting && (
							/*
							 * La fiche du clan est publique — identité, effectif, membres,
							 * réseaux. Seule la CANDIDATURE demande une session.
							 *
							 * Sans session on envoie directement vers la connexion : ouvrir le
							 * formulaire de motivation pour rediriger à l'envoi ferait perdre
							 * le message déjà écrit.
							 */
							<Button
								onClick={() =>
									isAuthenticated
										? setApplicationOpen(true)
										: window.location.assign(
												`/achillea/auth?returnUrl=/achillea/clans/${clanId}`,
											)
								}
								className="rounded-xl font-bold text-xs shadow-md"
							>
								{isAuthenticated ? "Postuler dans ce clan" : "Se connecter pour postuler"}
							</Button>
						)}
					</div>
				</div>
			</div>

			{/* Description & Biographie */}
			{clan.clanBiography && (
				<Card className="rounded-2xl border-outline/20">
					<CardContent className="p-6 space-y-2">
						<h2 className="font-bold text-base text-on-surface">À propos du clan</h2>
						<p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">
							{clan.clanBiography}
						</p>
					</CardContent>
				</Card>
			)}

			{/* Roster & Membres */}
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Users className="size-5 text-primary" />
						<h2 className="text-xl font-black text-on-surface">Effectif du clan ({members.length})</h2>
					</div>
				</div>

				<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
					{sortedMembers.map((m) => (
						<div
							key={m.user?.id}
							className="flex items-center justify-between p-3.5 rounded-2xl border border-outline/20 bg-surface hover:border-primary/40 transition-colors"
						>
							<div className="flex items-center gap-3 min-w-0">
								<UserAvatar
									userId={m.user?.id}
									avatar={m.user?.avatar}
									name={m.user?.username}
									size="md"
								/>
								<div className="min-w-0">
									<Link
										href={`/achillea/users/${m.user?.id}`}
										className="font-bold text-sm text-on-surface hover:text-primary transition-colors truncate block"
									>
										{m.user?.username}
									</Link>
									<span className="text-[11px] text-on-surface-variant">
										Rejoint le {new Date(m.createdAt).toLocaleDateString("fr-FR")}
									</span>
								</div>
							</div>

							<Badge variant={roleBadgeVariant(m.clanRole as unknown as number)} className="text-[10px] shrink-0 font-bold">
								{roleLabel(m.clanRole as unknown as number)}
							</Badge>
						</div>
					))}
				</div>
			</div>

			{/* Modal Candidature */}
			<Dialog open={applicationOpen} onOpenChange={setApplicationOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Rejoindre {clan.name}</DialogTitle>
						<DialogDescription>
							Envoie ton message de motivation au staff de ce clan.
						</DialogDescription>
					</DialogHeader>

					{applicationSuccess ? (
						<div className="py-6 text-center space-y-2 text-green-600 font-bold">
							<Check className="size-10 mx-auto" />
							<p>Ta candidature a été transmise au clan avec succès !</p>
						</div>
					) : (
						<div className="space-y-4 py-2">
							<textarea
								value={applicationMsg}
								onChange={(e) => setApplicationMsg(e.target.value)}
								placeholder="Présente-toi brièvement (expérience de jeu, disponibilités, motivations)..."
								rows={4}
								className="w-full p-3 rounded-xl border border-outline/30 bg-surface-variant/20 text-sm text-on-surface focus:outline-none focus:border-primary"
							/>
						</div>
					)}

					<DialogFooter>
						<Button variant="ghost" onClick={() => setApplicationOpen(false)}>
							Annuler
						</Button>
						{!applicationSuccess && (
							<Button onClick={handleApply} disabled={applying}>
								{applying ? "Envoi..." : "Envoyer ma candidature"}
							</Button>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
