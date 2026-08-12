import type { Metadata } from "next";
import { Button } from "@rosegriffon/ui";
import { Icon } from "@/components/ui/Icon";
import { getLatestNiersDesktopRelease, type NiersDesktopRelease } from "@/lib/niers-releases";

// Page 100 % DYNAMIQUE côté données de version : `getLatestNiersDesktopRelease()` (source partagée
// avec `/tools/niers/latest.json`, l'endpoint updater Tauri) résout la dernière release GitHub à
// chaque revalidation — plus aucune version/tag/nom de fichier en dur à mettre à jour manuellement
// ici après une nouvelle release niers (cf. `scripts/release-desktop.sh` côté dépôt niers).
export const revalidate = 3600; // NIERS_RELEASE_REVALIDATE (littéral requis — segment config Next.js statiquement analysé)

const GITHUB_REPO_URL = "https://github.com/aphrody-code/nie";
const BLENDER_ADDON_VERSION = "1.1.0"; // versionné indépendamment de l'app (blender_manifest.toml, tools/niers/)

export const metadata: Metadata = {
	alternates: { canonical: "/tools/niers" },
	description:
		"niers : explorateur de données et extension Blender pour Inazuma Eleven: Victory Road. Parcourez les fichiers du jeu, prévisualisez modèles 3D/textures/vidéos/sons, gérez vos mods et importez directement dans Blender.",
	openGraph: {
		description:
			"Explorateur de données et extension Blender pour Inazuma Eleven: Victory Road — prévisualisation 3D/image/vidéo/audio, recherche précise, mods, sauvegardes.",
		locale: "fr_FR",
		siteName: "Azalée - Inazuma Eleven Victory Road",
		title: "niers | Azalée",
		type: "website",
		url: "/tools/niers",
	},
	title: "niers — Explorateur de données & extension Blender - Azalée",
};

function FeatureItem({ icon, children }: { icon: string; children: React.ReactNode }) {
	return (
		<li className="flex items-start gap-3">
			<span className="
     mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-container
     text-on-primary-container
   ">
				<Icon name={icon} size={18} />
			</span>
			<span className="type-body-medium text-on-surface-variant leading-relaxed">{children}</span>
		</li>
	);
}

/** Bouton de téléchargement — désactivé + libellé explicite si la release GitHub est indisponible
 * (panne API, aucune release signée publiée) plutôt qu'un lien mort silencieux. */
function DownloadButton({
	asset,
	children,
	variant,
}: {
	asset: { url: string } | null;
	children: React.ReactNode;
	variant?: "outline";
}) {
	if (!asset) {
		return (
			<Button disabled size="default" variant={variant}>
				<Icon name="download" size={18} />
				Indisponible
			</Button>
		);
	}
	return (
		<Button asChild size="default" variant={variant}>
			<a href={asset.url} download>
				<Icon name="download" size={18} />
				{children}
			</a>
		</Button>
	);
}

export default async function NiersToolPage() {
	const release: NiersDesktopRelease | null = await getLatestNiersDesktopRelease();

	return (
		<div className="w-full space-y-10">
			<header className="space-y-2">
				<h1 className="
      font-[BradBunR] text-2xl
      sm:text-3xl
      md:text-4xl
      text-on-surface tracking-wide
    ">
					niers
				</h1>
				<p className="type-body-large text-on-surface-variant max-w-2xl leading-relaxed">
					Réécriture Rust byte-exact du moteur d'Inazuma Eleven: Victory Road. Deux outils open
					source pour explorer les données de votre propre copie du jeu : une application desktop et
					une extension Blender.
				</p>
			</header>

			{/* App desktop */}
			<section className="
     rounded-xl bg-surface-container elevation-1 p-5
     sm:p-8
     space-y-6
   ">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 className="type-title-large text-on-surface flex items-center gap-2">
							<Icon name="folder_open" size={22} className="text-primary" />
							niers — application desktop
						</h2>
						<p className="type-body-small text-on-surface-variant">
							Windows x64 · Tauri{release ? ` · v${release.version}` : ""}
						</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<DownloadButton asset={release?.msi ?? null}>Télécharger (.msi)</DownloadButton>
						<DownloadButton asset={release?.nsis ?? null} variant="outline">
							.exe (NSIS)
						</DownloadButton>
					</div>
				</div>

				<ul className="
      grid grid-cols-1
      sm:grid-cols-2
      gap-x-6 gap-y-3
    ">
					<FeatureItem icon="folder_open">
						Explorateur du système de fichiers virtuel du jeu (dx11 + packs CPK), avec description
						précise du rôle de chaque dossier.
					</FeatureItem>
					<FeatureItem icon="search">
						Recherche exacte de personnages et techniques par nom et par catégorie (élément, poste),
						sans faux positifs.
					</FeatureItem>
					<FeatureItem icon="view_in_ar">
						Prévisualisation de modèles 3D, textures, vidéos et sons directement dans
						l'application, avec inspecteur redimensionnable.
					</FeatureItem>
					<FeatureItem icon="build">
						Gestion de mods avec zone de préparation, avant écriture dans le dossier du jeu.
					</FeatureItem>
					<FeatureItem icon="save">Visualiseur et export de fichiers de sauvegarde.</FeatureItem>
					<FeatureItem icon="link">
						Recherche en ligne connectée à Azalée (personnages, techniques, objets, auras).
					</FeatureItem>
					<FeatureItem icon="translate">
						Données de configuration lues avec leurs vrais noms de champs, balises du moteur et
						furigana résolues en français, anglais et japonais.
					</FeatureItem>
				</ul>
			</section>

			{/* Ligne de commande */}
			<section className="
     rounded-xl bg-surface-container elevation-1 p-5
     sm:p-8
     space-y-6
   ">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 className="type-title-large text-on-surface flex items-center gap-2">
							<Icon name="deployed_code" size={22} className="text-primary" />
							niers — ligne de commande
						</h2>
						<p className="type-body-small text-on-surface-variant">
							Windows · Linux · incluse dans le code source
						</p>
					</div>
				</div>

				<ul className="
      grid grid-cols-1
      sm:grid-cols-2
      gap-x-6 gap-y-3
    ">
					<FeatureItem icon="image">
						<code className="type-body-small">niers convert</code> — textures du jeu vers PNG, WebP
						sans perte, GIF, JPEG, BMP, TGA, TIFF ou QOI.
					</FeatureItem>
					<FeatureItem icon="grid_view">
						Atlas d'icônes exportés en feuille CSS, SVG autonome ou manifeste JSON, régions et
						coordonnées lues dans le fichier du jeu.
					</FeatureItem>
					<FeatureItem icon="graphic_eq">
						Audio du jeu décodé en WAV — HCA, ADX, ACB et AWB, y compris les sons diffusés depuis
						un fichier voisin.
					</FeatureItem>
					<FeatureItem icon="inventory_2">
						<code className="type-body-small">niers viola</code> — extraction, empaquetage et
						fusion de mods au champ, avec presets de sélection.
					</FeatureItem>
					<FeatureItem icon="download">
						<code className="type-body-small">niers steam</code> — récupération du jeu et de ses
						composants depuis Steam.
					</FeatureItem>
					<FeatureItem icon="info">
						<code className="type-body-small">niers info</code> — état de l'installation :
						empreinte du binaire, volume du système de fichiers virtuel, composants de lancement.
					</FeatureItem>
				</ul>

				<div className="rounded-lg bg-surface-container-high p-4 type-body-small text-on-surface-variant">
					La ligne de commande se construit depuis le code source :{" "}
					<code>cargo build -p nie-cli --release</code>. Elle ne redistribue aucun asset — elle lit
					votre propre installation du jeu.
				</div>
			</section>

			{/* Extension Blender */}
			<section className="
     rounded-xl bg-surface-container elevation-1 p-5
     sm:p-8
     space-y-6
   ">
				<div className="flex flex-wrap items-start justify-between gap-4">
					<div className="space-y-1">
						<h2 className="type-title-large text-on-surface flex items-center gap-2">
							<Icon name="extension" size={22} className="text-primary" />
							niers — extension Blender
						</h2>
						<p className="type-body-small text-on-surface-variant">Blender 4.2+ · v{BLENDER_ADDON_VERSION}</p>
					</div>
					<DownloadButton asset={release?.blenderZip ?? null}>Télécharger (.zip)</DownloadButton>
				</div>

				<ul className="
      grid grid-cols-1
      sm:grid-cols-2
      gap-x-6 gap-y-3
    ">
					<FeatureItem icon="deployed_code">
						Format Extensions Blender officiel (blender_manifest.toml) — installation via Extensions
						→ Installer depuis un fichier.
					</FeatureItem>
					<FeatureItem icon="image_search">
						Panneau « niers » : recherche de personnages et techniques (local + API/GraphQL
						azalee) et import direct par nom ou catégorie, sans quitter Blender.
					</FeatureItem>
				</ul>

				<div className="rounded-lg bg-surface-container-high p-4 type-body-small text-on-surface-variant">
					Installation : Blender → Édition → Préférences → Extensions → icône ⌄ → Installer depuis
					un fichier… → sélectionnez le .zip téléchargé.
				</div>
			</section>

			{!release && (
				<p className="type-body-small text-error">
					Impossible de récupérer la dernière release depuis GitHub pour le moment — réessayez plus
					tard, ou téléchargez directement depuis{" "}
					<a href={`${GITHUB_REPO_URL}/releases`} className="
       underline underline-offset-2
       hover:no-underline
     ">
						la page des releases
					</a>
					.
				</p>
			)}

			<p className="type-body-small text-on-surface-variant max-w-2xl">
				niers lit les fichiers de votre propre installation locale du jeu ; aucun asset n'est
				redistribué. Code source et{" "}
				<a
					href={release?.releaseUrl ?? `${GITHUB_REPO_URL}/releases`}
					className="
       text-primary underline underline-offset-2
       hover:no-underline
     "
				>
					notes de version
				</a>{" "}
				sur{" "}
				<a
					href={GITHUB_REPO_URL}
					className="
       text-primary underline underline-offset-2
       hover:no-underline
     "
				>
					GitHub
				</a>
				.
			</p>
		</div>
	);
}
