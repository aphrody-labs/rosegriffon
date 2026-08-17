/**
 * L'éditeur d'avatar du jeu, rejoué depuis ses propres fichiers.
 *
 * Le jeu construit un joueur personnalisé à partir de `chara_edit_<version>.cfg.bin` : 502 parts
 * réparties en catégories, 470 couleurs en palettes, 218 curseurs de morphing, 38 visages
 * prédéfinis (chacun étant une *recette* de 62 à 72 lignes), 96 voix et 24 personnalités. Rien
 * de tout cela n'est écrit ici : la page consomme le catalogue **résolu** produit côté `niers`
 * (`niers avatar export`), servi par `nie-model-serve` sur `/avatar/catalog.json`.
 *
 * Ce que « résolu » veut dire, et pourquoi c'était le travail difficile : le catalogue ne
 * désigne presque rien par son nom. Trois familles de CRC-32 cohabitent, et le nom des champs
 * induit en erreur —
 *
 *   - `resourceName1` est le hash du **modèle 3D** (`hairF001` → `_hairF/hairF001.g4md`) ;
 *   - `textureName` n'est PAS une texture de modèle mais l'**icône de la vignette** affichée
 *     dans la grille (`icon_ava_face05_001`), résolue via la base de connaissance de `niers` ;
 *   - le `presetID` d'une recette est le hash du nom d'une part : `preset_01_normal` est à la
 *     fois une vignette sélectionnable et une recette complète.
 *
 * Les vignettes viennent donc de `/avatar/icon/<nom>.png`, décodées à la volée depuis les atlas
 * `menu/200_icon/21_icon_avatar/` du jeu.
 *
 * Les libellés de catégorie ne sont pas rédigés : ils dérivent du préfixe commun des noms de
 * ressources de la catégorie (`eye_`, `mouth_`, `eyebrow_`…), tel qu'il apparaît dans les
 * fichiers. Quand le jeu nomme quelque chose lui-même — les personnalités — le libellé vient de
 * `menu_text`, pas d'une liste écrite à la main.
 */
import type { Metadata } from "next";
import { MediaCount, MediaEmpty, MediaHeader } from "@/components/wiki/MediaShell";
import { AvatarEditor } from "./AvatarEditor";
import type { Catalogue } from "./types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
	title: "Éditeur d'avatar — Azalée",
	description:
		"Les 502 parts, 470 couleurs, 218 curseurs et 38 visages prédéfinis de l'éditeur de personnage d'Inazuma Eleven: Victory Road, lus dans les fichiers du jeu.",
};

/** Origine qui sert le catalogue et les vignettes (nie-model-serve derrière le CDN). */
const CDN = process.env.NEXT_PUBLIC_CDN_ORIGIN ?? "https://cdn.rosegriffon.fr";

/**
 * Charge le catalogue résolu. `null` si la source est injoignable — la page rend alors son
 * cadre en le disant, plutôt qu'une 500 : une source absente n'est pas une page cassée.
 */
async function chargerCatalogue(): Promise<Catalogue | null> {
	try {
		const reponse = await fetch(`${CDN}/avatar/catalog.json`, { cache: "no-store" });
		if (!reponse.ok) return null;
		return (await reponse.json()) as Catalogue;
	} catch {
		return null;
	}
}

export default async function Page() {
	const catalogue = await chargerCatalogue();

	if (!catalogue) {
		return (
			<div className="space-y-6">
				<MediaHeader
					title="Éditeur d'avatar"
					description="Le catalogue de création de personnage, lu dans les fichiers du jeu."
					active="/avatar"
				/>
				<MediaEmpty>
					Catalogue injoignable — il est produit par «&nbsp;niers avatar export&nbsp;» et servi sur
					/avatar/catalog.json.
				</MediaEmpty>
			</div>
		);
	}

	const parts = catalogue.categories.reduce((n, c) => n + c.parts.length, 0);
	const couleurs = catalogue.categories.reduce((n, c) => n + c.couleurs.length, 0);
	const curseurs = catalogue.curseurs.reduce((n, g) => n + g.params.length, 0);

	return (
		<div className="space-y-6">
			<MediaHeader
				title="Éditeur d'avatar"
				description={
					<>
						Le jeu compose un joueur à partir de {parts} parts, {couleurs} couleurs et {curseurs}{" "}
						curseurs de morphing. Tout ce qui suit est lu dans ses fichiers — vignettes comprises,
						décodées depuis les atlas d'icônes.
					</>
				}
				active="/avatar"
			/>
			<MediaCount
				left={`${catalogue.categories.length} catégories · ${catalogue.presets.length} visages prédéfinis`}
				right={`code de partage : ${catalogue.codePartage.bits} bits sur ${catalogue.codePartage.alphabet.length} caractères`}
			/>
			<AvatarEditor catalogue={catalogue} cdn={CDN} />
		</div>
	);
}
