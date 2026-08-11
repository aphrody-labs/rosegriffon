"use client";

import { Camera, Loader2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "../../lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "../avatar";
import { Badge } from "../badge";
import { Card, CardContent } from "../card";

interface AccountAvatarCardProps {
	avatarUrl?: string | null;
	username?: string | null;
	/** Rôle affiché sous le pseudo (« Membre », « Admin »…). */
	role?: string | null;
	/**
	 * Téléverse le fichier et renvoie l'URL publique définitive.
	 *
	 * Elle DOIT être unique par téléversement (nom de fichier horodaté ou
	 * aléatoire) : réutiliser un chemin fixe renvoie la même URL, que le
	 * navigateur et le CDN servent depuis leur cache — l'ancienne image reste
	 * alors affichée alors que le stockage a bien été mis à jour.
	 */
	onUpload: (file: File) => Promise<string>;
}

const MAX_BYTES = 4 * 1024 * 1024;

export function AccountAvatarCard({
	avatarUrl,
	username,
	role,
	onUpload,
}: AccountAvatarCardProps) {
	const inputId = useId();
	const inputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl ?? null);

	const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		// Réinitialise tout de suite : sans ça, resélectionner le même fichier
		// après un échec ne déclenche pas de nouvel évènement `change`.
		event.target.value = "";
		if (!file) {
			return;
		}
		if (!file.type.startsWith("image/")) {
			toast.error("Choisis un fichier image.");
			return;
		}
		if (file.size > MAX_BYTES) {
			toast.error("Image trop lourde (4 Mo maximum).");
			return;
		}

		setUploading(true);
		try {
			const url = await onUpload(file);
			setPreviewUrl(url);
			toast.success("Avatar mis à jour.");
		} catch (error) {
			console.error("[compte] échec du téléversement d'avatar", error);
			toast.error(error instanceof Error ? error.message : "Erreur lors de l'envoi de l'image.");
		} finally {
			setUploading(false);
		}
	};

	return (
		<Card>
			<CardContent className="flex flex-col items-center gap-6 p-6 sm:p-8">
				<div className="group relative">
					<Avatar className="size-28 border-4 border-border shadow-lg transition-colors group-hover:border-primary/50 sm:size-36">
						<AvatarImage src={previewUrl ?? undefined} alt="" className="object-cover" />
						<AvatarFallback className="select-none bg-primary/10 text-4xl font-bold text-primary uppercase">
							{username?.[0] ?? "?"}
						</AvatarFallback>
					</Avatar>

					{/* Voile de survol : purement décoratif, l'action passe par le bouton. */}
					<div
						className={cn(
							"pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 opacity-0 transition-opacity",
							!uploading && "group-hover:opacity-100"
						)}
						aria-hidden
					>
						<Camera className="size-9 text-background" strokeWidth={1.5} />
					</div>

					{uploading && (
						<div className="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-foreground/60">
							<Loader2 className="size-9 animate-spin text-background" aria-hidden />
						</div>
					)}

					{/* Bouton réel : un <label> seul n'est pas focusable au clavier. */}
					<button
						type="button"
						onClick={() => inputRef.current?.click()}
						disabled={uploading}
						aria-controls={inputId}
						className="absolute right-0 bottom-0 z-30 flex size-11 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-95 disabled:opacity-50"
					>
						<Upload className="size-5" aria-hidden />
						<span className="sr-only">Changer d'avatar</span>
					</button>

					<input
						ref={inputRef}
						id={inputId}
						type="file"
						className="sr-only"
						accept="image/png,image/jpeg,image/webp,image/gif"
						onChange={handleChange}
						disabled={uploading}
						tabIndex={-1}
					/>
				</div>

				<div className="w-full space-y-2 text-center">
					<p className="truncate text-lg font-bold text-foreground">{username || "Utilisateur"}</p>
					{role && (
						<Badge variant="secondary" className="rounded-full">
							{role}
						</Badge>
					)}
					<p className="text-xs text-muted-foreground">
						PNG, JPEG ou WebP — 400 × 400 px recommandé, 4 Mo maximum.
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
