"use client";

import { useState } from "react";
import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Textarea,
	Form,
	FormControl,
	FormDescription,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
	Badge,
} from "@rose-griffon/ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Crown, Star, ShieldCheck, Heart, Sparkles, Check } from "lucide-react";

import { AvatarUpload } from "@/components/auth/AvatarUpload";
import type { Database } from "@rose-griffon/db";
import { updateProfile } from "../actions";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const AVAILABLE_BADGES = [
	{
		id: "founder",
		label: "Fondateur",
		icon: Crown,
		color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
		iconColor: "text-amber-500",
		description: "Membre fondateur de la communauté Rose Griffon.",
	},
	{
		id: "vip",
		label: "VIP",
		icon: Star,
		color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
		iconColor: "text-purple-500",
		description: "Invité de marque ou contributeur exceptionnel.",
	},
	{
		id: "beta",
		label: "Beta Tester",
		icon: Sparkles,
		color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
		iconColor: "text-cyan-500",
		description: "A participé activement aux tests de Victory Road.",
	},
	{
		id: "patreon",
		label: "Patreon",
		icon: Heart,
		color: "bg-rose-500/10 text-rose-500 border-rose-500/20",
		iconColor: "text-rose-500",
		description: "Soutien officiel du projet sur Patreon.",
	},
	{
		id: "staff",
		label: "Staff",
		icon: ShieldCheck,
		color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
		iconColor: "text-blue-500",
		description: "Membre de l'équipe d'administration du site.",
	},
];

const PRESET_BANNERS = [
	{
		id: "none",
		name: "Aura Rose Griffon (Par défaut)",
		url: "",
		previewUrl: "/patterns/grid.svg",
		className: "bg-linear-to-r from-[#a14b3f] via-[#c47867] to-[#d16854]",
	},
	{
		id: "griffon_one",
		name: "Rose Griffon Officiel",
		url: "/images/banners/griffon_banner_one.png",
		previewUrl: "/images/banners/griffon_banner_one.png",
		className: "",
	},
	{
		id: "lightning_two",
		name: "Foudre Inazuma",
		url: "/images/banners/lightning_banner_two.png",
		previewUrl: "/images/banners/lightning_banner_two.png",
		className: "",
	},
];

const schema = z.object({
	banner_url: z.string().optional().or(z.literal("")),
	bio: z.string().max(500, "La bio ne peut pas dépasser 500 caractères.").optional(),
	full_name: z.string().optional(),
	twitter_handle: z.string().optional(),
	username: z
		.string()
		.min(3, "Le nom d'utilisateur doit faire au moins 3 caractères.")
		.max(20, "Le nom d'utilisateur ne peut pas dépasser 20 caractères."),
	website: z.string().url("URL invalide").optional().or(z.literal("")),
	badges: z.array(z.string()).max(3, "Tu ne peux pas sélectionner plus de 3 badges.").default([]),
});

export function ProfileSection({ profile }: { profile: Profile | null }) {
	const [customBannerMode, setCustomBannerMode] = useState(
		profile?.banner_url ? !PRESET_BANNERS.some((b) => b.url === profile.banner_url) : false
	);

	const form = useForm({
		defaultValues: {
			banner_url: profile?.banner_url || "",
			bio: profile?.bio || "",
			full_name: profile?.full_name || "",
			twitter_handle: profile?.twitter_handle || "",
			username: profile?.username || "",
			website: profile?.website || "",
			badges: profile?.badges ?? [],
		},
		resolver: zodResolver(schema),
	});

	const onSubmit = async (values: z.infer<typeof schema>) => {
		const fd = new FormData();
		Object.entries(values).forEach(([k, v]) => {
			if (k === "badges" && Array.isArray(v)) {
				v.forEach((badge) => fd.append("badges", badge));
			} else {
				fd.append(k, (v as string) ?? "");
			}
		});

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
				if (errs.username) {
					form.setError("username", {
						type: "manual",
						message: errs.username[0],
					});
				}
				toast.error("Corrige les erreurs du formulaire.", { id: t });
			}
			return;
		}
		toast.success("Profil mis à jour", { id: t });
	};

	const handleBannerSelect = (url: string) => {
		setCustomBannerMode(false);
		form.setValue("banner_url", url);
	};

	const toggleBadge = (badgeId: string) => {
		const currentBadges = form.getValues("badges") || [];
		if (currentBadges.includes(badgeId)) {
			form.setValue(
				"badges",
				currentBadges.filter((id) => id !== badgeId)
			);
		} else {
			if (currentBadges.length >= 3) {
				toast.error("Tu ne peux pas afficher plus de 3 badges à la fois.");
				return;
			}
			form.setValue("badges", [...currentBadges, badgeId]);
		}
	};

	const selectedBadges = form.watch("badges") || [];
	const currentBannerUrl = form.watch("banner_url");

	return (
		<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
			<Card className="md:col-span-1">
				<CardHeader>
					<CardTitle>Avatar</CardTitle>
					<CardDescription>Visible sur ton profil public et les commentaires.</CardDescription>
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
										<FormDescription>Unique. Apparaît dans l'URL de ton profil.</FormDescription>
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

							{/* SECTION COSMÉTIQUE : BANNIÈRES */}
							<div className="space-y-4 border-t border-border pt-6">
								<div>
									<h3 className="text-sm font-semibold text-foreground">Bannière de profil</h3>
									<p className="text-xs text-muted-foreground">
										Personnalise l'arrière-plan supérieur de ton profil public.
									</p>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
									{PRESET_BANNERS.map((preset) => {
										const isSelected = !customBannerMode && currentBannerUrl === preset.url;
										return (
											<button
												type="button"
												key={preset.id}
												onClick={() => handleBannerSelect(preset.url)}
												className={`group relative h-20 rounded-xl overflow-hidden border-2 text-left transition-all ${
													isSelected
														? "border-primary ring-2 ring-primary/20 scale-[1.02]"
														: "border-border hover:border-muted-foreground/50"
												}`}
											>
												{preset.url ? (
													<img
														src={preset.previewUrl}
														alt=""
														className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105 duration-500"
													/>
												) : (
													<div className={`absolute inset-0 ${preset.className}`} />
												)}
												<div className="absolute inset-0 bg-black/40 hover:bg-black/30 transition-colors flex items-end p-2">
													<span className="text-[10px] font-bold text-white leading-tight">
														{preset.name}
													</span>
												</div>
												{isSelected && (
													<div className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md">
														<Check size={12} strokeWidth={3} />
													</div>
												)}
											</button>
										);
									})}
								</div>

								<div className="flex items-center gap-2 pt-2">
									<Button
										type="button"
										variant={customBannerMode ? "secondary" : "outline"}
										size="sm"
										className="rounded-full"
										onClick={() => {
											setCustomBannerMode(true);
											if (!customBannerMode) form.setValue("banner_url", "");
										}}
									>
										Utiliser une URL personnalisée
									</Button>
								</div>

								{customBannerMode && (
									<FormField
										control={form.control}
										name="banner_url"
										render={({ field }) => (
											<FormItem className="animate-in fade-in slide-in-from-top-2 duration-300">
												<FormLabel>URL de ta bannière</FormLabel>
												<FormControl>
													<Input placeholder="https://..." {...field} />
												</FormControl>
												<FormDescription>
													Image distante (imgur, discordapp, CDN...). Format recommandé : 1200x400.
												</FormDescription>
												<FormMessage />
											</FormItem>
										)}
									/>
								)}
							</div>

							{/* SECTION COSMÉTIQUE : BADGES */}
							<div className="space-y-4 border-t border-border pt-6">
								<div>
									<h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
										Badges de profil
										<Badge variant="outline" className="rounded-full text-[10px] font-bold">
											{selectedBadges.length} / 3 sélectionnés
										</Badge>
									</h3>
									<p className="text-xs text-muted-foreground">
										Sélectionne jusqu'à 3 badges à afficher à côté de ton nom.
									</p>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									{AVAILABLE_BADGES.map((badge) => {
										const isSelected = selectedBadges.includes(badge.id);
										return (
											<button
												type="button"
												key={badge.id}
												onClick={() => toggleBadge(badge.id)}
												className={`flex items-start gap-3 p-3 rounded-2xl border-2 text-left transition-all ${
													isSelected
														? "border-primary bg-primary/5 shadow-sm scale-[1.01]"
														: "border-border hover:border-muted-foreground/30 hover:bg-muted/10"
												}`}
											>
												<div className={`p-2 rounded-xl border ${badge.color} shrink-0`}>
													<badge.icon className={`size-5 ${badge.iconColor}`} />
												</div>
												<div className="min-w-0 flex-1">
													<span className="font-bold text-sm text-foreground block">
														{badge.label}
													</span>
													<span className="text-xs text-muted-foreground leading-relaxed block mt-0.5">
														{badge.description}
													</span>
												</div>
												<div
													className={`size-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 mt-0.5 ${
														isSelected
															? "bg-primary border-primary text-on-primary"
															: "border-muted-foreground/30"
													}`}
												>
													{isSelected && <Check size={12} strokeWidth={3} />}
												</div>
											</button>
										);
									})}
								</div>
							</div>

							<div className="pt-4">
								<Button
									type="submit"
									disabled={form.formState.isSubmitting}
									className="rounded-full px-8"
								>
									{form.formState.isSubmitting ? "Enregistrement..." : "Enregistrer le profil"}
								</Button>
							</div>
						</form>
					</Form>
				</CardContent>
			</Card>
		</div>
	);
}
