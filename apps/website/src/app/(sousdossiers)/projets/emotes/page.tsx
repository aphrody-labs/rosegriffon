"use client";

export const dynamic = "force-dynamic";

import {
	Badge,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@rose-griffon/ui";
import { useState } from "react";
import { Toaster, toast } from "sonner";

import RgEmote from "@/components/shared/emotes/RgEmote";
import { BreadcrumbSchema, ImageObjectSchema } from "@/components/shared/StructuredData";

import { EMOTES } from "@/lib/emotes";
import type { Emote } from "@/lib/emotes";
import { Copy, Smile } from "@/lib/icons-config";

export default function EmotesPage() {
	const [activeTab, setActiveTab] = useState("all");

	const copyEmoteName = (name: string) => {
		navigator.clipboard.writeText(`:${name}:`);
		toast.success(`Code :${name}: copié !`);
	};

	const EmoteGrid = ({ filter }: { filter?: (e: Emote) => boolean }) => {
		const emotes = Object.values(EMOTES).filter(filter || (() => true));

		return (
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
				{emotes.map((emote) => (
					<div
						key={emote.name}
						className="group relative flex flex-col items-center justify-between p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-primary/20 hover:shadow-md transition-all duration-300"
					>
						<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
							<Button
								variant="ghost"
								size="icon"
								className="size-6"
								onClick={() => copyEmoteName(emote.name)}
								title="Copier le code"
							>
								<Copy className="size-3" />
							</Button>
						</div>

						<div className="flex-1 flex items-center justify-center py-4">
							<RgEmote
								name={emote.name as keyof typeof EMOTES}
								size={80}
								animated
								preventDownload
								className="drop-shadow-sm group-hover:scale-110 transition-transform duration-300"
							/>
						</div>

						<div className="w-full text-center space-y-1">
							<p className="text-sm font-medium truncate" title={emote.name}>
								{emote.name}
							</p>
							<Badge variant="secondary" className="text-[10px] px-1.5 h-5">
								:{emote.name}:
							</Badge>
							{emote.author && (
								<p className="text-[10px] text-muted-foreground mt-1">
									Par{" "}
									{emote.authorUrl ? (
										<a
											href={emote.authorUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="hover:text-primary hover:underline transition-colors"
										>
											{emote.author}
										</a>
									) : (
										emote.author
									)}
								</p>
							)}
						</div>
					</div>
				))}
			</div>
		);
	};

	return (
		<div className="min-h-screen bg-background pb-12">
			<BreadcrumbSchema
				items={[
					{ item: "/", name: "Accueil" },
					{ item: "/projets", name: "Projets" },
					{ item: "/projets/emotes", name: "Galerie d'Emotes" },
				]}
			/>
			{Object.values(EMOTES).map((emote) => (
				<ImageObjectSchema
					key={emote.name}
					url={`https://rosegriffon.fr${emote.path}`}
					name={`Emote ${emote.name}`}
					description={emote.alt}
					author={emote.author || "Rose Griffon"}
				/>
			))}
			<Toaster richColors position="top-center" />
			{/* Hero Section */}
			<section className="relative overflow-hidden rounded-b-3xl bg-linear-to-br from-primary/10 via-background to-background p-8 md:p-12 lg:p-16 text-center border-b border-border/50">
				<div className="absolute top-0 right-0 -mt-12 -mr-12 size-64 rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute bottom-0 left-0 -mb-12 -ml-12 size-64 rounded-full bg-blue-500/5 blur-3xl" />

				<div className="relative z-10 mx-auto max-w-3xl space-y-6">
					<div className="inline-flex items-center rounded-full border border-border bg-background/50 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm">
						<Smile className="mr-2 size-4" />
						<span>Galerie Officielle</span>
					</div>

					<h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
						Emotes Rose Griffon
					</h1>

					<p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
						Découvrez et utilisez la collection complète des expressions de nos mascottes Gaëlle et
						Roy.
					</p>
				</div>
			</section>

			<div className="container mx-auto px-4 mt-8 max-w-7xl">
				<Tabs
					defaultValue="all"
					value={activeTab}
					onValueChange={setActiveTab}
					className="w-full space-y-8"
				>
					<div className="flex justify-center">
						<TabsList className="grid w-full max-w-2xl grid-cols-3 h-auto p-1">
							<TabsTrigger value="all" className="py-2">
								Toutes
							</TabsTrigger>
							<TabsTrigger value="gaelle" className="py-2 gap-2">
								Gaëlle
								<RgEmote name="gaelle-salut" size={20} preventDownload />
							</TabsTrigger>
							<TabsTrigger value="roy" className="py-2 gap-2">
								Roy
								<RgEmote name="roy-salut" size={20} preventDownload />
							</TabsTrigger>
						</TabsList>
					</div>

					<TabsContent
						value="all"
						className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
					>
						<Card className="border-none shadow-none bg-transparent">
							<CardHeader className="px-0">
								<div className="flex items-center justify-between">
									<div>
										<CardTitle>Collection Complète</CardTitle>
										<CardDescription>
											{Object.keys(EMOTES).length} emotes disponibles
										</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="px-0">
								<EmoteGrid />
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="gaelle"
						className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
					>
						<Card className="border-none shadow-none bg-transparent">
							<CardHeader className="px-0">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-pink-100 dark:bg-pink-900/20 rounded-xl">
										<RgEmote name="gaelle-fiere" size={40} animated preventDownload />
									</div>
									<div>
										<CardTitle>Emotes de Gaëlle</CardTitle>
										<CardDescription>Les expressions de notre capitaine</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="px-0">
								<EmoteGrid filter={(e) => e.character === "gaelle"} />
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="roy"
						className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
					>
						<Card className="border-none shadow-none bg-transparent">
							<CardHeader className="px-0">
								<div className="flex items-center gap-3">
									<div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-xl">
										<RgEmote name="roy-evil" size={40} animated preventDownload />
									</div>
									<div>
										<CardTitle>Emotes de Roy</CardTitle>
										<CardDescription>Le côté obscur de la force</CardDescription>
									</div>
								</div>
							</CardHeader>
							<CardContent className="px-0">
								<EmoteGrid filter={(e) => e.character === "roy"} />
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
