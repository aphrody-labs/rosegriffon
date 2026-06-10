"use client";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
	Textarea,
	Label,
	Separator,
} from "@rose-griffon/ui";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { updateSetting } from "@/app/admin/settings/actions";
// Component Imports for Preview
import { AchilleaBanner } from "@/components/home/AchilleaBanner";
import { AzaleeBanner } from "@/components/home/AzaleeBanner";
import { RgtvBanner } from "@/components/home/RgtvBanner";
import FusionBlock from "@/components/shared/FusionBlock";

export interface Setting {
	key: string;
	value: string;
	description?: string;
}

interface VisualSettingsEditorProps {
	settings: Setting[];
}

// Helper to get value from settings array or default
const getVal = (settings: Setting[], key: string, def: string) => {
	const found = settings.find((s) => s.key === key);
	return found ? found.value : def;
};

export function VisualSettingsEditor({ settings: initialSettings }: VisualSettingsEditorProps) {
	const [settings, setSettings] = useState<Setting[]>(initialSettings);
	const [loading, setLoading] = useState<string | null>(null);

	// Helper to update local state instantly for preview
	const updateLocal = (key: string, value: string) => {
		setSettings((prev) => {
			const existing = prev.find((s) => s.key === key);
			if (existing) {
				return prev.map((s) => (s.key === key ? { ...s, value } : s));
			}
			return [...prev, { key, value }];
		});
	};

	const handleSave = async (key: string, value: string, description?: string) => {
		setLoading(key);
		try {
			const result = await updateSetting(key, value, description);
			if (result.message.includes("Erreur")) {
				toast.error(result.message);
			} else {
				toast.success("Enregistré !");
			}
		} catch {
			toast.error("Erreur inconnue");
		} finally {
			setLoading(null);
		}
	};

	// Field Renderer
	const Field = ({
		label,
		sKey,
		def,
		type = "text",
		desc,
	}: {
		label: string;
		sKey: string;
		def: string;
		type?: "text" | "textarea";
		desc?: string;
	}) => {
		const val = getVal(settings, sKey, def);
		return (
			<div className="space-y-2">
				<div className="flex items-center justify-between">
					<Label htmlFor={sKey} className="font-medium">
						{label}
					</Label>
					{val !== def && (
						<span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full">
							Modifié
						</span>
					)}
				</div>
				<div className="flex gap-2">
					{type === "textarea" ? (
						<Textarea
							id={sKey}
							value={val}
							onChange={(e) => updateLocal(sKey, e.target.value)}
							className="min-h-[80px]"
						/>
					) : (
						<Input id={sKey} value={val} onChange={(e) => updateLocal(sKey, e.target.value)} />
					)}
					<Button
						size="icon"
						variant={val === getVal(initialSettings, sKey, def) ? "ghost" : "default"}
						onClick={() => handleSave(sKey, val, desc)}
						disabled={loading === sKey}
						title="Sauvegarder ce champ"
					>
						{loading === sKey ? (
							<Loader2 className="size-4 animate-spin" />
						) : (
							<Save className="size-4" />
						)}
					</Button>
				</div>
				{desc && <p className="text-[11px] text-muted-foreground">{desc}</p>}
			</div>
		);
	};

	return (
		<Tabs defaultValue="intro" className="w-full space-y-6">
			<TabsList className="flex flex-wrap h-auto p-1 bg-muted/50 gap-1">
				<TabsTrigger value="intro" className="flex-1 min-w-[100px]">
					Intro & Général
				</TabsTrigger>
				<TabsTrigger value="rgtv" className="flex-1 min-w-[100px]">
					RG TV
				</TabsTrigger>
				<TabsTrigger value="azalee" className="flex-1 min-w-[100px]">
					Azalée
				</TabsTrigger>
				<TabsTrigger value="achillea" className="flex-1 min-w-[100px]">
					Achillea
				</TabsTrigger>
				<TabsTrigger value="community" className="flex-1 min-w-[100px]">
					Communauté
				</TabsTrigger>
				<TabsTrigger value="advanced" className="flex-1 min-w-[100px]">
					Avancé
				</TabsTrigger>
			</TabsList>

			{/* --- INTRO TAB --- */}
			<TabsContent value="intro" className="space-y-6 animate-in fade-in-50">
				<div className="grid lg:grid-cols-2 gap-8">
					<Card>
						<CardHeader>
							<CardTitle>Introduction</CardTitle>
							<CardDescription>La première section visible sur la page d'accueil.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Field label="Titre" sKey="home_intro_title" def="Qu'est-ce que Rose Griffon ?" />
							<Field
								label="Texte"
								sKey="home_intro_text"
								def="Rose Griffon est une association française régie par la loi de 1901, ayant pour vocation de rassembler les principaux acteurs de la communauté Inazuma Eleven ainsi que l'ensemble des passionnés sous une même bannière."
								type="textarea"
							/>
							<Field
								label="Image URL"
								sKey="home_intro_image"
								def="/RG_screens_twitch_ethan.webp"
							/>
						</CardContent>
					</Card>

					<div className="space-y-4">
						<Label className="text-muted-foreground uppercase text-xs tracking-wider">
							Aperçu en direct
						</Label>
						<div className="border rounded-3xl p-4 bg-muted/30 dark:bg-black/20 overflow-hidden">
							<FusionBlock
								isImageLeft
								image={getVal(settings, "home_intro_image", "/RG_screens_twitch_ethan.webp")}
							>
								<div className="space-y-4 flex flex-col justify-center h-full p-4">
									<h2 className="text-xl md:text-3xl font-bold leading-tight text-foreground">
										{getVal(settings, "home_intro_title", "Qu'est-ce que Rose Griffon ?")}
									</h2>
									<p className="text-sm md:text-base leading-relaxed text-foreground/80">
										{getVal(
											settings,
											"home_intro_text",
											"Rose Griffon est une association française régie par la loi de 1901..."
										)}
									</p>
								</div>
							</FusionBlock>
						</div>
					</div>
				</div>
			</TabsContent>

			{/* --- RGTV TAB --- */}
			<TabsContent value="rgtv" className="space-y-6 animate-in fade-in-50">
				<div className="grid lg:grid-cols-2 gap-8">
					<Card>
						<CardHeader>
							<CardTitle>Rose Griffon TV</CardTitle>
							<CardDescription>Configuration de la bannière WebTV.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Field label="Titre" sKey="home_rgtv_title" def="RG TV" />
							<Field label="Sous-titre" sKey="home_rgtv_subtitle" def="WebTV Officielle" />
							<Field
								label="Description"
								sKey="home_rgtv_description"
								def="Votre rendez-vous quotidien Inazuma Eleven !"
								type="textarea"
							/>
							<Field label="Image URL" sKey="home_rgtv_image" def="/rgtv/affiche.webp" />
							<Field label="Texte Bouton" sKey="home_rgtv_button_text" def="ACCÉDER À LA WEBTV" />
							<Field label="Lien" sKey="home_rgtv_link" def="/rose-griffon-tv" />
						</CardContent>
					</Card>

					<div className="space-y-4">
						<Label className="text-muted-foreground uppercase text-xs tracking-wider">
							Aperçu en direct
						</Label>
						<div className="border rounded-3xl p-4 bg-muted/30 dark:bg-black/20">
							<RgtvBanner
								title={getVal(settings, "home_rgtv_title", "RG TV")}
								subtitle={getVal(settings, "home_rgtv_subtitle", "WebTV Officielle")}
								description={getVal(
									settings,
									"home_rgtv_description",
									"Votre rendez-vous quotidien Inazuma Eleven !"
								)}
								image={getVal(settings, "home_rgtv_image", "/rgtv/affiche.webp")}
								buttonText={getVal(settings, "home_rgtv_button_text", "ACCÉDER À LA WEBTV")}
								link={getVal(settings, "home_rgtv_link", "/rose-griffon-tv")}
							/>
						</div>
					</div>
				</div>
			</TabsContent>

			{/* --- AZALEE TAB --- */}
			<TabsContent value="azalee" className="space-y-6 animate-in fade-in-50">
				<div className="grid lg:grid-cols-2 gap-8">
					<Card>
						<CardHeader>
							<CardTitle>Azalée</CardTitle>
							<CardDescription>Configuration de la bannière Actualités.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Field label="Titre" sKey="home_azalee_title" def="AZALÉE" />
							<Field label="Badge (Tag)" sKey="home_azalee_tag" def="Actualités" />
							<Field
								label="Description"
								sKey="home_azalee_description"
								def="Le pilier médiatique de Rose Griffon."
								type="textarea"
							/>
							<Field label="Image URL" sKey="home_azalee_image" def="https://azalee.rosegriffon.fr/opengraph-image" />
							<Field label="Logo URL" sKey="home_azalee_logo" def="/RG_Azalee-logo.webp" />
							<Separator />
							<Field
								label="Lien Twitter"
								sKey="home_azalee_twitter"
								def="https://x.com/Azalee_IE"
							/>
							<Field
								label="Lien Instagram"
								sKey="home_azalee_instagram"
								def="https://www.instagram.com/azaleefr/"
							/>
						</CardContent>
					</Card>

					<div className="space-y-4">
						<Label className="text-muted-foreground uppercase text-xs tracking-wider">
							Aperçu en direct
						</Label>
						<div className="border rounded-3xl p-4 bg-muted/30 dark:bg-black/20">
							<AzaleeBanner
								title={getVal(settings, "home_azalee_title", "AZALÉE")}
								tag={getVal(settings, "home_azalee_tag", "Actualités")}
								description={getVal(
									settings,
									"home_azalee_description",
									"Le pilier médiatique de Rose Griffon."
								)}
								image={getVal(settings, "home_azalee_image", "https://azalee.rosegriffon.fr/opengraph-image")}
								logo={getVal(settings, "home_azalee_logo", "/RG_Azalee-logo.webp")}
								twitterLink={getVal(settings, "home_azalee_twitter", "https://x.com/Azalee_IE")}
								instagramLink={getVal(
									settings,
									"home_azalee_instagram",
									"https://www.instagram.com/azaleefr/"
								)}
							/>
						</div>
					</div>
				</div>
			</TabsContent>

			{/* --- ACHILLEA TAB --- */}
			<TabsContent value="achillea" className="space-y-6 animate-in fade-in-50">
				<div className="grid lg:grid-cols-2 gap-8">
					<Card>
						<CardHeader>
							<CardTitle>Achillea</CardTitle>
							<CardDescription>Configuration de la bannière E-Sport.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Field
								label="Description"
								sKey="home_achillea_description"
								def="Le carrefour de l'esport Inazuma Eleven !"
								type="textarea"
							/>
							<Field label="Image URL" sKey="home_achillea_image" def="https://achillea.rosegriffon.fr/opengraph-image" />
							<Field
								label="Lien Site"
								sKey="home_achillea_link"
								def="https://achillea.rosegriffon.fr/"
							/>
							<Field
								label="Lien Discord"
								sKey="home_achillea_discord"
								def="https://discord.gg/achillea-competitif-inazuma-eleven-fr-1055585286320554055"
							/>
						</CardContent>
					</Card>

					<div className="space-y-4">
						<Label className="text-muted-foreground uppercase text-xs tracking-wider">
							Aperçu en direct
						</Label>
						<div className="border rounded-3xl p-4 bg-muted/30 dark:bg-black/20">
							<AchilleaBanner
								description={getVal(
									settings,
									"home_achillea_description",
									"Le carrefour de l'esport Inazuma Eleven !"
								)}
								image={getVal(settings, "home_achillea_image", "https://achillea.rosegriffon.fr/opengraph-image")}
								link={getVal(settings, "home_achillea_link", "https://achillea.rosegriffon.fr/")}
								discordLink={getVal(
									settings,
									"home_achillea_discord",
									"https://discord.gg/achillea-competitif-inazuma-eleven-fr-1055585286320554055"
								)}
							/>
						</div>
					</div>
				</div>
			</TabsContent>

			{/* --- COMMUNITY TAB --- */}
			<TabsContent value="community" className="space-y-6 animate-in fade-in-50">
				<Card className="max-w-2xl">
					<CardHeader>
						<CardTitle>Section Communauté</CardTitle>
						<CardDescription>
							Titres et textes de la zone "Rejoignez la communauté".
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<Field
							label="Titre Principal"
							sKey="home_community_title"
							def="Rejoignez la communauté"
						/>
						<Field
							label="Sous-titre"
							sKey="home_community_subtitle"
							def="Rose Griffon est partout !"
							type="textarea"
						/>
						<Field
							label="Petite description Discord"
							sKey="home_community_description"
							def="Le cœur de la communauté"
						/>
					</CardContent>
				</Card>
			</TabsContent>

			{/* --- ADVANCED TAB (Fallback) --- */}
			<TabsContent value="advanced" className="space-y-6">
				<Card>
					<CardHeader>
						<CardTitle>Éditeur Brut</CardTitle>
						<CardDescription>
							Accès direct à toutes les clés de configuration. Utilisez ceci pour les paramètres non
							listés ci-dessus (ex: feature flags).
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{/* You could re-use the old list editor here if needed,
                 or simply list all keys not caught by other tabs. 
                 For now, let's keep it simple. */}
						<div className="text-sm text-yellow-600 bg-yellow-50 p-4 rounded-lg">
							Tous les paramètres sont accessibles via la base de données ou les onglets dédiés.
							Utilisez cette vue pour ajouter des clés personnalisées.
						</div>
						{/* Simple Add New Logic could go here */}
					</CardContent>
				</Card>
			</TabsContent>
		</Tabs>
	);
}
