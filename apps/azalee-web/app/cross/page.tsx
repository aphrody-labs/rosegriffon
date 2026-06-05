import type { Metadata } from "next";
import Image from "next/image";
import { Play } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@rose-griffon/ui";
import { crossData } from "./data";

const GOOGLE_PLAY = "https://play.google.com/store/apps/details?id=jp.co.level5.inazumacross";
const OFFICIAL_SITE = "https://www.inazuma-cross.jp/";
const X_ACCOUNT = "https://x.com/inazuma_cross";

export const metadata: Metadata = {
	title: "Inazuma Eleven Cross — le nouveau jeu mobile | Azalée",
	description:
		"Inazuma Eleven Cross (イナズマイレブン クロス), le nouveau jeu mobile Level-5 en pré-enregistrement. Histoire, système de jeu, news et récompenses — jeu distinct d'Inazuma Eleven: Victory Road.",
	openGraph: {
		title: "Inazuma Eleven Cross — le nouveau jeu mobile",
		description:
			"Le nouveau jeu mobile Level-5 en pré-enregistrement. Nouveau protagoniste Yo Shiosawa, histoire originale au FFI.",
		images: ["/inazuma-cross/ogp.jpg"],
	},
};

function formatFrDate(iso: string): string {
	const d = new Date(`${iso}T00:00:00Z`);
	return d.toLocaleDateString("fr-FR", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

export default function CrossPage() {
	const { status, spec, introduction, protagonist, news, samuraiBlue2026, movies, localImages } =
		crossData;

	return (
		<div className="w-full pb-12">
			{/* Bandeau d'avertissement — jeu distinct d'IEVR */}
			<div className="mb-6 rounded-xl border border-tertiary/30 bg-tertiary-container/40 px-4 py-3">
				<p className="type-body-medium text-on-tertiary-container">
					<span className="font-bold">À noter :</span> Inazuma Eleven Cross est un jeu mobile
					<span className="font-bold"> distinct</span> d&apos;Inazuma Eleven: Victory Road (le jeu
					console/PC couvert par le reste du wiki). Il est actuellement{" "}
					<span className="font-bold">en pré-enregistrement</span> et n&apos;est pas encore sorti.
				</p>
			</div>

			{/* HERO */}
			<section className="relative mb-12 overflow-hidden rounded-3xl border-2 border-primary/30 bg-surface-container-low shadow-level-2">
				<div className="absolute inset-0">
					<Image
						src={localImages.keyVisual}
						alt="Inazuma Eleven Cross — visuel principal"
						fill
						priority
						sizes="100vw"
						className="object-cover opacity-30"
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-surface-container-low/70 to-surface-container-low/30" />
				</div>
				<div className="relative flex flex-col items-center px-6 py-14 text-center sm:py-20">
					<Image
						src={localImages.logo}
						alt="Logo Inazuma Eleven Cross"
						width={420}
						height={160}
						priority
						className="mb-6 h-auto w-[min(420px,80vw)] drop-shadow-[0_4px_0_rgba(0,0,0,0.4)]"
					/>
					<h1 className="type-display-medium mb-2 font-bold text-primary">
						Inazuma Eleven Cross
					</h1>
					<p className="type-title-medium mb-6 text-on-surface-variant">
						{crossData.site.title} — {crossData.site.subtitle}
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						<Badge className="bg-tertiary px-4 py-1.5 text-on-tertiary type-label-large">
							Pré-enregistrement
						</Badge>
						<Badge
							variant="outline"
							className="border-primary/50 px-4 py-1.5 text-primary type-label-large"
						>
							Sortie : {formatFrDate(status.serviceStart)}
						</Badge>
					</div>
					<div className="mt-8 flex flex-wrap items-center justify-center gap-3">
						<a
							href={GOOGLE_PLAY}
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-full bg-primary px-6 py-3 type-label-large font-medium text-on-primary shadow-level-1 transition-transform hover:scale-105"
						>
							Pré-enregistrer sur Google Play
						</a>
						<a
							href={OFFICIAL_SITE}
							target="_blank"
							rel="noopener noreferrer"
							className="rounded-full border border-outline px-6 py-3 type-label-large font-medium text-on-surface transition-colors hover:bg-surface-container-high"
						>
							Site officiel
						</a>
					</div>
				</div>
			</section>

			{/* INTRODUCTION / HISTOIRE */}
			<section className="mb-12">
				<h2 className="type-headline-medium mb-6 font-bold text-primary">Introduction</h2>
				<div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
					<div className="prose prose-lg max-w-none dark:prose-invert">
						{introduction.storyFr.split("Mais ").map((chunk, i) => (
							<p key={i} className="type-body-large text-on-surface-variant">
								{i === 0 ? chunk : `Mais ${chunk}`}
							</p>
						))}
					</div>
					<Card className="self-start overflow-hidden border-l-8 border-l-secondary bg-surface-container-low shadow-sm">
						<div className="relative aspect-[3/4] bg-surface-container-high">
							<Image
								src={localImages.protagonist}
								alt={`${protagonist.nameRomaji} — protagoniste`}
								fill
								sizes="320px"
								className="object-contain"
							/>
						</div>
						<CardHeader>
							<CardTitle className="type-title-large">
								{protagonist.nameRomaji}
								<span className="ml-2 type-body-medium text-on-surface-variant">
									{protagonist.nameJa}
								</span>
							</CardTitle>
						</CardHeader>
						<CardContent>
							<Badge className="mb-3 bg-secondary-container text-on-secondary-container">
								Protagoniste
							</Badge>
							<p className="type-body-medium text-on-surface-variant">
								{protagonist.descriptionFr}
							</p>
						</CardContent>
					</Card>
				</div>
			</section>

			{/* SYSTÈME / FICHE TECHNIQUE */}
			<section className="mb-12">
				<h2 className="type-headline-medium mb-6 font-bold text-primary">Système de jeu</h2>
				<div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
					<Card className="border-l-8 border-l-primary bg-surface-container-low shadow-sm">
						<CardHeader>
							<CardTitle className="type-title-large">Fiche technique</CardTitle>
						</CardHeader>
						<CardContent>
							<dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
								<dt className="type-label-large text-on-surface-variant">Titre</dt>
								<dd className="type-body-large text-on-surface">{spec.title}</dd>
								<dt className="type-label-large text-on-surface-variant">Genre</dt>
								<dd className="type-body-large text-on-surface">{spec.genreFr}</dd>
								<dt className="type-label-large text-on-surface-variant">Plateformes</dt>
								<dd className="type-body-large text-on-surface">{spec.platforms}</dd>
								<dt className="type-label-large text-on-surface-variant">Modèle</dt>
								<dd className="type-body-large text-on-surface">{spec.pricingFr}</dd>
								<dt className="type-label-large text-on-surface-variant">Sortie</dt>
								<dd className="type-body-large text-on-surface">
									{formatFrDate(status.serviceStart)}
								</dd>
								<dt className="type-label-large text-on-surface-variant">Studios</dt>
								<dd className="type-body-large text-on-surface">
									{spec.developers.join(" × ")}
								</dd>
							</dl>
							<p className="mt-4 type-body-small text-on-surface-variant/70">{status.note}</p>
						</CardContent>
					</Card>
					<div className="grid grid-cols-2 gap-3">
						{localImages.systemScreenshots.map((src, i) => (
							<div
								key={src}
								className="relative aspect-[9/16] overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-high"
							>
								<Image
									src={src}
									alt={`Capture d'écran ${i + 1}`}
									fill
									sizes="(max-width: 1024px) 45vw, 22vw"
									className="object-cover"
								/>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* NEWS */}
			<section className="mb-12">
				<h2 className="type-headline-medium mb-6 font-bold text-primary">Actualités</h2>
				<Card className="bg-surface-container-low shadow-sm">
					<CardContent className="divide-y divide-outline-variant/20 p-0">
						{news.map((item) => (
							<a
								key={`${item.date}-${item.titleJa}`}
								href={item.url}
								target="_blank"
								rel="noopener noreferrer"
								className="flex flex-col gap-1 px-5 py-4 transition-colors hover:bg-surface-container-high sm:flex-row sm:items-center sm:gap-4"
							>
								<time className="type-label-large shrink-0 text-primary">
									{formatFrDate(item.date)}
								</time>
								<span className="type-body-large text-on-surface">{item.titleFr}</span>
							</a>
						))}
					</CardContent>
				</Card>
			</section>

			{/* RÉCOMPENSES PRÉ-ENREGISTREMENT */}
			<section className="mb-12">
				<h2 className="type-headline-medium mb-2 font-bold text-primary">
					Récompenses de pré-enregistrement
				</h2>
				<p className="mb-6 type-body-large text-on-surface-variant">
					{crossData.rewards.noteFr}
				</p>
				<a
					href={GOOGLE_PLAY}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-2 rounded-full bg-tertiary px-6 py-3 type-label-large font-medium text-on-tertiary shadow-level-1 transition-transform hover:scale-105"
				>
					S&apos;inscrire au pré-enregistrement
				</a>
			</section>

			{/* COLLABORATION SAMURAI BLUE 2026 */}
			<section className="mb-12">
				<h2 className="type-headline-medium mb-2 font-bold text-primary">
					{samuraiBlue2026.titleFr}
				</h2>
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
					<div>
						<p className="mb-4 type-body-large text-on-surface-variant">
							{samuraiBlue2026.descriptionFr}
						</p>
						<p className="mb-4 type-body-medium text-on-surface-variant/80">
							Période : {samuraiBlue2026.eventPeriod}
						</p>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							{samuraiBlue2026.limitedCharacters.map((c) => (
								<Card
									key={c.nameJa}
									className="border-l-8 border-l-secondary bg-surface-container-low shadow-sm"
								>
									<CardHeader>
										<CardTitle className="flex items-center gap-2 type-title-medium">
											<Badge className="bg-primary text-on-primary">{c.position}</Badge>
											{c.nameFr}
										</CardTitle>
									</CardHeader>
									<CardContent>
										<p className="mb-2 type-label-large text-on-surface-variant">
											Édition Équipe Nationale 2026
										</p>
										<ul className="list-inside list-disc type-body-medium text-on-surface-variant">
											{c.skills.map((s) => (
												<li key={s}>{s}</li>
											))}
										</ul>
									</CardContent>
								</Card>
							))}
						</div>
						<p className="mt-4 type-body-small text-on-surface-variant/70">
							{samuraiBlue2026.designNoteFr}
						</p>
					</div>
					<div className="relative aspect-[4/3] self-start overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-high">
						<Image
							src={localImages.samuraiBlue}
							alt={samuraiBlue2026.titleFr}
							fill
							sizes="360px"
							className="object-cover"
						/>
					</div>
				</div>
			</section>

			{/* VIDÉOS */}
			<section className="mb-12">
				<h2 className="type-headline-medium mb-6 font-bold text-primary">Vidéos</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{movies.youtube.map((m) => (
						<a
							key={m.id}
							href={`https://www.youtube.com/watch?v=${m.id}`}
							target="_blank"
							rel="noopener noreferrer"
							className="group flex items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low px-5 py-4 transition-colors hover:bg-surface-container-high"
						>
							<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-error/90 text-on-error">
								<Play className="size-5" fill="currentColor" />
							</span>
							<span className="type-body-large text-on-surface group-hover:text-primary">
								{m.labelFr}
							</span>
						</a>
					))}
				</div>
			</section>

			{/* LIENS OFFICIELS */}
			<section>
				<h2 className="type-headline-medium mb-6 font-bold text-primary">Liens officiels</h2>
				<div className="flex flex-wrap gap-3">
					<a
						href={OFFICIAL_SITE}
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-full border border-outline px-5 py-2.5 type-label-large text-on-surface transition-colors hover:bg-surface-container-high"
					>
						Site officiel
					</a>
					<a
						href={X_ACCOUNT}
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-full border border-outline px-5 py-2.5 type-label-large text-on-surface transition-colors hover:bg-surface-container-high"
					>
						X @inazuma_cross
					</a>
					<a
						href={GOOGLE_PLAY}
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-full border border-outline px-5 py-2.5 type-label-large text-on-surface transition-colors hover:bg-surface-container-high"
					>
						Google Play (pré-enregistrement)
					</a>
					<a
						href="https://www.level5.co.jp/"
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-full border border-outline px-5 py-2.5 type-label-large text-on-surface transition-colors hover:bg-surface-container-high"
					>
						Level-5
					</a>
				</div>
				<p className="mt-8 type-body-small text-on-surface-variant/60">{spec.copyright}</p>
			</section>
		</div>
	);
}
