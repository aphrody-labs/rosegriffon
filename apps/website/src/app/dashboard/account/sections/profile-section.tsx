"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea, Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@rose-griffon/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { AvatarUpload } from "@/components/auth/AvatarUpload";


import type { Database } from "@rose-griffon/db";

import { updateProfile } from "../actions";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const schema = z.object({
	banner_url: z.string().url("URL invalide").optional().or(z.literal("")),
	bio: z
		.string()
		.max(500, "La bio ne peut pas dépasser 500 caractères.")
		.optional(),
	full_name: z.string().optional(),
	twitter_handle: z.string().optional(),
	username: z
		.string()
		.min(3, "Le nom d'utilisateur doit faire au moins 3 caractères.")
		.max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères."),
	website: z.string().url("URL invalide").optional().or(z.literal("")),
});

export function ProfileSection({ profile }: { profile: Profile | null }) {
	const form = useForm<z.infer<typeof schema>>({
		defaultValues: {
			banner_url: profile?.banner_url || "",
			bio: profile?.bio || "",
			full_name: profile?.full_name || "",
			twitter_handle: profile?.twitter_handle || "",
			username: profile?.username || "",
			website: profile?.website || "",
		},
		resolver: zodResolver(schema),
	});

	const onSubmit = async (values: z.infer<typeof schema>) => {
		const fd = new FormData();
		Object.entries(values).forEach(([k, v]) => fd.append(k, v ?? ""));
		// Préserver les champs adresse non touchés ici
		if (profile) {
			for (const k of [
				"address_line1",
				"address_line2",
				"city",
				"postal_code",
				"country",
			] as const) {
				fd.append(k, (profile[k] as string | null) ?? "");
			}
		}
		const t = toast.loading("Mise à jour du profil...");
		const res = await updateProfile(fd);
		if (res.error) {
			if (typeof res.error === "string") {
				toast.error("Erreur", { description: res.error, id: t });
			} else {
				const errs = res.error as Record<string, string[]>;
				if (errs.username)
					{form.setError("username", {
						type: "manual",
						message: errs.username[0],
					});}
				toast.error("Corrige les erreurs du formulaire.", { id: t });
			}
			return;
		}
		toast.success("Profil mis à jour", { id: t });
	};

	return (
		<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
			<Card className="md:col-span-1">
				<CardHeader>
					<CardTitle>Avatar</CardTitle>
					<CardDescription>
						Visible sur ton profil public et les commentaires.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<AvatarUpload />
				</CardContent>
			</Card>

			<Card className="md:col-span-2">
				<CardHeader>
					<CardTitle>Profil public</CardTitle>
					<CardDescription>
						Visible par les autres membres sur /profil/
						{form.watch("username") || "..."}
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Form {...form}>
						<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
							<FormField
								control={form.control}
								name="username"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Nom d'utilisateur</FormLabel>
										<FormControl>
											<Input placeholder="pseudo" {...field} />
										</FormControl>
										<FormDescription>
											Unique. Apparaît dans l'URL de ton profil.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="full_name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Nom complet</FormLabel>
										<FormControl>
											<Input placeholder="Prénom Nom" {...field} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="bio"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Bio</FormLabel>
										<FormControl>
											<Textarea
												placeholder="Courte description visible sur ton profil"
												className="resize-none"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<FormField
									control={form.control}
									name="website"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Site web</FormLabel>
											<FormControl>
												<Input placeholder="https://exemple.com" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
								<FormField
									control={form.control}
									name="twitter_handle"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Twitter / X</FormLabel>
											<FormControl>
												<Input placeholder="@pseudo" {...field} />
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>
							</div>
							<FormField
								control={form.control}
								name="banner_url"
								render={({ field }) => (
									<FormItem>
										<FormLabel>URL bannière</FormLabel>
										<FormControl>
											<Input placeholder="https://..." {...field} />
										</FormControl>
										<FormDescription>
											Image affichée en haut de ton profil public.
										</FormDescription>
										<FormMessage />
									</FormItem>
								)}
							/>
							<Button type="submit" disabled={form.formState.isSubmitting}>
								{form.formState.isSubmitting
									? "Enregistrement..."
									: "Enregistrer le profil"}
							</Button>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}