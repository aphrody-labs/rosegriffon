import type { Metadata } from "next";
import { Button } from "@rose-griffon/ui";
import { Icon } from "@/components/ui/Icon";

const RELEASE_TAG = "v0.1.0";
const RELEASE_BASE = `https://github.com/aphrody-code/niers/releases/download/${RELEASE_TAG}`;
const RELEASE_URL = `https://github.com/aphrody-code/niers/releases/tag/${RELEASE_TAG}`;

const DOWNLOADS = {
	blenderZip: `${RELEASE_BASE}/niers-1.0.22.zip`,
	msi: `${RELEASE_BASE}/niers_0.1.0_x64_en-US.msi`,
	setupExe: `${RELEASE_BASE}/niers_0.1.0_x64-setup.exe`,
};

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

export default function NiersToolPage() {
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
						<p className="type-body-small text-on-surface-variant">Windows x64 · Tauri · v0.1.0</p>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button asChild size="default">
							<a href={DOWNLOADS.msi} download>
								<Icon name="download" size={18} />
								Télécharger (.msi)
							</a>
						</Button>
						<Button asChild variant="outline" size="default">
							<a href={DOWNLOADS.setupExe} download>
								<Icon name="download" size={18} />
								.exe (NSIS)
							</a>
						</Button>
					</div>
				</div>

				<ul className="
      grid grid-cols-1
      sm:grid-cols-2
      gap-x-6 gap-y-3
    ">
					<FeatureItem icon="explore">
						Explorateur du système de fichiers virtuel du jeu (dx11 + packs CPK), avec description
						précise du rôle de chaque dossier.
					</FeatureItem>
					<FeatureItem icon="search">
						Recherche exacte de personnages et techniques par nom et par catégorie (élément, poste),
						sans faux positifs.
					</FeatureItem>
					<FeatureItem icon="view_in_ar">
						Prévisualisation de modèles 3D, textures, vidéos et sons directement dans l'application.
					</FeatureItem>
					<FeatureItem icon="construction">
						Gestion de mods avec zone de préparation, avant écriture dans le dossier du jeu.
					</FeatureItem>
					<FeatureItem icon="save">Visualiseur et export de fichiers de sauvegarde.</FeatureItem>
					<FeatureItem icon="cloud">
						Recherche en ligne connectée à Azalée (personnages, techniques, objets, auras).
					</FeatureItem>
				</ul>
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
						<p className="type-body-small text-on-surface-variant">Blender 4.2+ · v1.0.22</p>
					</div>
					<Button asChild size="default">
						<a href={DOWNLOADS.blenderZip} download>
							<Icon name="download" size={18} />
							Télécharger (.zip)
						</a>
					</Button>
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
					<FeatureItem icon="person_search">
						Panneau « Level-5 » : recherche et import de personnages et techniques par nom ou
						catégorie, sans quitter Blender.
					</FeatureItem>
				</ul>

				<div className="rounded-lg bg-surface-container-high p-4 type-body-small text-on-surface-variant">
					Installation : Blender → Édition → Préférences → Extensions → icône ⌄ → Installer depuis
					un fichier… → sélectionnez le .zip téléchargé.
				</div>
			</section>

			<p className="type-body-small text-on-surface-variant max-w-2xl">
				niers lit les fichiers de votre propre installation locale du jeu ; aucun asset n'est
				redistribué. Assets et données du jeu © Level-5. Code source et{" "}
				<a
					href={RELEASE_URL}
					className="
       text-primary underline underline-offset-2
       hover:no-underline
     "
				>
					notes de version
				</a>{" "}
				sur{" "}
				<a
					href="https://github.com/aphrody-code/niers"
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
