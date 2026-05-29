"use client";

import { Input, Label } from "@rose-griffon/ui";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { updateUserAvatar } from "@/app/dashboard/account/actions";

import { authClient } from "@/lib/auth-client";
import { createClient } from "@/lib/supabase/client";

export function AvatarUpload() {
	const { data: session } = authClient.useSession();
	const [uploading, setUploading] = useState(false);
	const userId = session?.user?.id ?? null;
	const supabase = createClient();

	// Biome-ignore lint/correctness/useExhaustiveDependencies: pas de dépendances nécessaires
	useEffect(() => {}, []);

	const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
		try {
			setUploading(true);
			if (!event.target.files || event.target.files.length === 0) {
				throw new Error("You must select an image to upload.");
			}
			if (!userId) {
				throw new Error("User not found.");
			}

			const file = event.target.files[0];
			if (!file) {
				throw new Error("Impossible de lire le fichier.");
			}
			const fileExt = file.name.split(".").pop();
			const filePath = `${userId}/avatar.${fileExt}`;

			const { error: uploadError } = await supabase.storage
				.from("avatars")
				.upload(filePath, file, { upsert: true });

			if (uploadError) {
				throw uploadError;
			}

			// Obtenir l'URL publique
			const {
				data: { publicUrl },
			} = supabase.storage.from("avatars").getPublicUrl(filePath);

			// Mettre à jour la base de données via la Server Action
			await updateUserAvatar(userId, publicUrl);

			toast.success("Avatar updated successfully!");
			// Optionnel: rafraîchir les données utilisateur
			// QueryClient.invalidateQueries(['user-profile']);
		} catch (error: unknown) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			toast.error(errorMessage);
		} finally {
			setUploading(false);
		}
	};

	return (
		<div>
			<Label htmlFor="avatar-upload">Avatar</Label>
			<Input
				id="avatar-upload"
				type="file"
				accept="image/png, image/jpeg"
				onChange={uploadAvatar}
				disabled={uploading}
			/>
			{uploading && <p>Uploading...</p>}
		</div>
	);
}
