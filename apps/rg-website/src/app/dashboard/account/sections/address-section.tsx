"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@rg/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { Truck } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@rg/ui";

import type { Database } from "@rg/db";

import { updateProfile } from "../actions";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const schema = z.object({
	address_line1: z.string().optional(),
	address_line2: z.string().optional(),
	city: z.string().optional(),
	postal_code: z.string().optional(),
	country: z.string().optional(),
});

export function AddressSection({ profile }: { profile: Profile | null }) {
	const form = useForm<z.infer<typeof schema>>({
		resolver: zodResolver(schema),
		defaultValues: {
			address_line1: profile?.address_line1 || "",
			address_line2: profile?.address_line2 || "",
			city: profile?.city || "",
			postal_code: profile?.postal_code || "",
			country: profile?.country || "",
		},
	});

	const onSubmit = async (values: z.infer<typeof schema>) => {
		const fd = new FormData();
		// Préserver les champs profil non touchés ici
		if (profile) {
			fd.append("username", profile.username ?? "");
			fd.append("full_name", profile.full_name ?? "");
			fd.append("bio", profile.bio ?? "");
			fd.append("website", profile.website ?? "");
			fd.append("twitter_handle", profile.twitter_handle ?? "");
			fd.append("banner_url", profile.banner_url ?? "");
		}
		Object.entries(values).forEach(([k, v]) => fd.append(k, v ?? ""));

		const t = toast.loading("Enregistrement de l'adresse...");
		const res = await updateProfile(fd);
		if (res.error) {
			const msg =
				typeof res.error === "string" ? res.error : "Adresse invalide";
			toast.error(msg, { id: t });
			return;
		}
		toast.success("Adresse enregistrée", { id: t });
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Truck className="size-5 text-muted-foreground" />
					Adresse de livraison
				</CardTitle>
				<CardDescription>
					Utilisée pour les commandes de la boutique RG (merch, récompenses
					patron). Privée — jamais affichée publiquement.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
						<FormField
							control={form.control}
							name="address_line1"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Adresse (ligne 1)</FormLabel>
									<FormControl>
										<Input
											placeholder="123 rue Inazuma"
											autoComplete="address-line1"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="address_line2"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Adresse (ligne 2)</FormLabel>
									<FormControl>
										<Input
											placeholder="Appartement, étage, bât. (optionnel)"
											autoComplete="address-line2"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<FormField
								control={form.control}
								name="postal_code"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Code postal</FormLabel>
										<FormControl>
											<Input
												placeholder="75001"
												autoComplete="postal-code"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="city"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Ville</FormLabel>
										<FormControl>
											<Input
												placeholder="Paris"
												autoComplete="address-level2"
												{...field}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</div>
						<FormField
							control={form.control}
							name="country"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Pays</FormLabel>
									<FormControl>
										<Input
											placeholder="France"
											autoComplete="country-name"
											{...field}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<Button type="submit" disabled={form.formState.isSubmitting}>
							{form.formState.isSubmitting
								? "Enregistrement..."
								: "Enregistrer l'adresse"}
						</Button>
					</form>
				</Form>
			</CardContent>
		</Card>
	);
}