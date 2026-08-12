"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	cn,
} from "@rosegriffon/ui";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Loader2, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { extraitTexte, type PostCampagne, urlPostX } from "@/lib/x-campagnes/types";

/*
 * Visionneuse plein écran d'une publication de campagne.
 *
 * Bâtie sur le `Dialog` partagé (Radix) : l'overlay, le piège de focus, la
 * fermeture par Échap et le verrou de défilement viennent gratuitement du
 * composant. Il ne reste ici que ce que Radix ne fournit pas : la navigation
 * ←/→ entre publications, le passage d'une image à l'autre au sein d'un même
 * post, et le téléchargement.
 *
 * Le bouton de fermeture natif du `DialogContent` est désactivé
 * (`showCloseButton={false}`) : son libellé lecteur d'écran est en anglais.
 */

/** Nom de fichier proposé au téléchargement, dérivé du pseudo et de l'identifiant. */
function nomFichier(post: PostCampagne, index: number, url: string): string {
	const extension = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "jpg";
	const extensionSure = /^(jpe?g|png|webp|gif|avif)$/.test(extension) ? extension : "jpg";
	const pseudo = post.auteurPseudo.replace(/[^\w-]+/g, "") || "post";
	return `${pseudo}-${post.tweetId}-${index + 1}.${extensionSure}`;
}

export function Visionneuse({
	posts,
	index,
	onFermer,
	onNaviguer,
}: {
	posts: PostCampagne[];
	/** Index de la publication ouverte, ou `null` si la visionneuse est fermée. */
	index: number | null;
	onFermer: () => void;
	onNaviguer: (nouvelIndex: number) => void;
}) {
	const [indexImage, setIndexImage] = useState(0);
	const [telechargement, setTelechargement] = useState(false);

	const ouverte = index !== null;
	const post = ouverte ? posts[index] : undefined;
	const aPrecedent = ouverte && index > 0;
	const aSuivant = ouverte && index < posts.length - 1;

	// Changer de publication remet la visionneuse sur la première image du post.
	useEffect(() => {
		setIndexImage(0);
	}, [index]);

	const allerPrecedent = useCallback(() => {
		if (index !== null && index > 0) {
			onNaviguer(index - 1);
		}
	}, [index, onNaviguer]);

	const allerSuivant = useCallback(() => {
		if (index !== null && index < posts.length - 1) {
			onNaviguer(index + 1);
		}
	}, [index, onNaviguer, posts.length]);

	// Radix gère Échap ; les flèches restent à notre charge.
	useEffect(() => {
		if (!ouverte) {
			return;
		}
		const surTouche = (evenement: KeyboardEvent) => {
			if (evenement.key === "ArrowLeft") {
				allerPrecedent();
			} else if (evenement.key === "ArrowRight") {
				allerSuivant();
			}
		};
		document.addEventListener("keydown", surTouche);
		return () => document.removeEventListener("keydown", surTouche);
	}, [ouverte, allerPrecedent, allerSuivant]);

	if (!post) {
		return null;
	}

	const image = post.images[indexImage] ?? post.images[0];
	const date = post.publieLe ? new Date(post.publieLe) : null;
	const dateValide = date && !Number.isNaN(date.getTime()) ? date : null;
	const legende = extraitTexte(post.texte, 400);

	const telecharger = async () => {
		if (!image || telechargement) {
			return;
		}
		// Original (pbs.twimg.com) de préférence : c'est la pleine résolution.
		const source = image.source || image.src;
		setTelechargement(true);
		try {
			const reponse = await fetch(source, { mode: "cors" });
			if (!reponse.ok) {
				throw new Error(`HTTP ${reponse.status}`);
			}
			const blob = await reponse.blob();
			const urlObjet = URL.createObjectURL(blob);
			const lien = document.createElement("a");
			lien.href = urlObjet;
			lien.download = nomFichier(post, indexImage, source);
			document.body.appendChild(lien);
			lien.click();
			lien.remove();
			URL.revokeObjectURL(urlObjet);
		} catch {
			// Repli : ouvrir l'image dans un nouvel onglet si le fetch échoue (CORS…).
			window.open(source, "_blank", "noopener");
		} finally {
			setTelechargement(false);
		}
	};

	return (
		<Dialog
			open={ouverte}
			onOpenChange={(ouvert) => {
				if (!ouvert) {
					onFermer();
				}
			}}
		>
			<DialogContent
				showCloseButton={false}
				aria-label={`Publication de @${post.auteurPseudo}`}
				className="max-h-[95dvh] max-w-[96vw] gap-0 overflow-y-auto rounded-[24px] border-2 border-rg-or/40 bg-surface-container-lowest p-0 sm:max-w-4xl lg:max-w-5xl"
			>
				<DialogTitle className="sr-only">
					Publication de @{post.auteurPseudo} — {index !== null ? index + 1 : 1} sur {posts.length}
				</DialogTitle>
				<DialogDescription className="sr-only">
					Utilisez les flèches gauche et droite pour changer de publication, la touche Échap pour
					fermer.
				</DialogDescription>

				{/* Barre d'outils : auteur à gauche, actions à droite. */}
				<div className="flex items-center justify-between gap-3 border-b border-outline-variant/40 px-4 py-3">
					<div className="flex min-w-0 flex-col">
						<span className="truncate text-sm font-bold text-on-surface">{post.auteurNom}</span>
						<span className="truncate text-xs text-on-surface-variant">
							@{post.auteurPseudo}
							{dateValide && ` · ${format(dateValide, "d MMMM yyyy", { locale: fr })}`}
						</span>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<button
							type="button"
							onClick={telecharger}
							disabled={!image || telechargement}
							aria-label="Télécharger l'image"
							className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:opacity-50 sm:min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							{telechargement ? (
								<Loader2 className="size-4 animate-spin" aria-hidden />
							) : (
								<Download className="size-4" aria-hidden />
							)}
							<span className="hidden sm:inline">Télécharger</span>
						</button>
						<button
							type="button"
							onClick={onFermer}
							aria-label="Fermer la visionneuse"
							className="flex size-11 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-high sm:size-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							<X className="size-5" aria-hidden />
						</button>
					</div>
				</div>

				{/* Image + flèches de navigation entre publications. */}
				<div className="relative flex h-[52dvh] items-center justify-center bg-surface-container-low sm:h-[62dvh]">
					{image ? (
						<Image
							key={`${post.tweetId}-${indexImage}`}
							src={image.src}
							alt={`Image ${indexImage + 1} sur ${post.images.length} publiée sur X par @${post.auteurPseudo}`}
							fill
							sizes="100vw"
							unoptimized
							priority
							className="object-contain"
						/>
					) : (
						<p className="text-sm text-on-surface-variant">Image indisponible.</p>
					)}

					{aPrecedent && (
						<button
							type="button"
							onClick={allerPrecedent}
							aria-label="Publication précédente"
							className="absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container/80 text-on-surface backdrop-blur-sm transition-colors hover:bg-surface-container-high sm:left-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							<ChevronLeft className="size-6" aria-hidden />
						</button>
					)}
					{aSuivant && (
						<button
							type="button"
							onClick={allerSuivant}
							aria-label="Publication suivante"
							className="absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface-container/80 text-on-surface backdrop-blur-sm transition-colors hover:bg-surface-container-high sm:right-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							<ChevronRight className="size-6" aria-hidden />
						</button>
					)}
				</div>

				{/* Vignettes des autres images de la MÊME publication. */}
				{post.images.length > 1 && (
					<div className="flex gap-2 overflow-x-auto border-t border-outline-variant/40 px-4 py-3">
						{post.images.map((autre, position) => (
							<button
								key={autre.src}
								type="button"
								onClick={() => setIndexImage(position)}
								aria-label={`Image ${position + 1} sur ${post.images.length}`}
								aria-current={position === indexImage}
								className={cn(
									"relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors" +
											" focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
									position === indexImage
										? "border-primary"
										: "border-outline-variant/40 hover:border-primary/60"
								)}
							>
								<Image
									src={autre.src}
									alt=""
									fill
									sizes="64px"
									quality={70}
									className="object-cover"
								/>
							</button>
						))}
					</div>
				)}

				{/* Légende, lien vers l'original, compteur de position. */}
				<div className="space-y-3 border-t border-outline-variant/40 px-4 py-4">
					{legende && (
						<p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
							{legende}
						</p>
					)}
					<div className="flex flex-wrap items-center justify-between gap-3">
						<a
							href={urlPostX(post.auteurPseudo, post.tweetId)}
							target="_blank"
							rel="noopener noreferrer"
							aria-label={`Voir la publication de @${post.auteurPseudo} sur X (nouvel onglet)`}
							className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 sm:min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
						>
							Voir sur X
							<ExternalLink className="size-4" aria-hidden />
						</a>
						<span className="text-xs font-medium text-on-surface-variant">
							{(index ?? 0) + 1} / {posts.length}
						</span>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
