"use client";

/**
 * L'écran d'édition d'avatar tel que le jeu le dispose — avec les assets du jeu.
 *
 * ## D'où vient chaque chose affichée
 *
 * | élément | source |
 * |---|---|
 * | fond | le sprite réel `menu/161_avatar/avatar01/avatar01_00`, décodé du CPK |
 * | icônes d'onglet | régions nommées `icon_menu0N_{on,off}` de l'atlas `mainmenu90_02_2` |
 * | vignettes | `icon_ava_*`, décodées à la volée depuis `menu/200_icon/21_icon_avatar/` |
 * | titres | rendus dans la police bitmap du jeu par `/ui/text.png` |
 * | rubriques | les 13 libellés du script `chara_edit_list_menu`, dans leur ordre |
 * | couleurs | échantillonnées sur des captures du jeu (cf. `GEOMETRIE`) |
 *
 * ## Pourquoi la géométrie est mesurée et non lue
 *
 * Le layout runtime que `niers` exporte pour cet écran place ses objets par un **repli** : ses
 * transforms sortent du canevas (`x = −596`, `y = 1678` pour un canevas de 1280×720), parce que
 * la position des widgets ne vit pas dans les fichiers de l'écran. Les rendre donnerait une
 * disposition fausse. Les proportions ci-dessous sont donc **relevées sur des captures du jeu**,
 * en pourcentage d'un cadre 2560×1440, ce qui est factuel et vérifiable — mais ne constitue pas
 * une conformité au pixel : rien ici n'a été comparé image à image au jeu.
 */

import { useMemo, useState } from "react";
import type { Catalogue, Categorie, Part } from "./types";

/**
 * Proportions relevées sur les captures (`var/refs-avatar/`, 2560×1440), en pourcentages.
 *
 * Bandeau : première ligne non bleue à y = 163. Colonne de rubriques : plaques blanches de
 * x = 34 à x = 533, première à y = 294, hauteur 71, pas 90,5. Panneau : x = 1614 → bord,
 * y = 262 → 1281.
 */
const GEOMETRIE = {
	bandeauH: (163 / 1440) * 100,
	colonneX: (34 / 2560) * 100,
	colonneW: ((533 - 34) / 2560) * 100,
	rubriqueY: (294 / 1440) * 100,
	rubriqueH: (71 / 1440) * 100,
	rubriquePas: (90.5 / 1440) * 100,
	panneauX: (1614 / 2560) * 100,
	panneauY: (262 / 1440) * 100,
	panneauW: ((2470 - 1614) / 2560) * 100,
	panneauH: ((1281 - 262) / 1440) * 100,
	/** Centres des six icônes d'onglet, relevés sur le bandeau. */
	ongletsX: [50, 56.8, 63.5, 70.2, 77, 83.8],
} as const;

/** Couleurs échantillonnées sur les captures. */
const COULEURS = {
	bandeauGauche: "#0EAFFF",
	bandeauDroite: "#1067F8",
	languette: "#59A8FF",
	texteRubrique: "#047AFF",
	barreBas: "#BAF2FF",
} as const;

const CDN_ATLAS_ONGLETS =
	"/tex/dx11/menu/100_mainmenu/mainmenu90/mainmenu90_02_2/mainmenu90_02_2.g4tx";
const FOND = "/dx11/menu/161_avatar/avatar01/avatar01_00/avatar01_00.png";

/**
 * Les six onglets du bandeau.
 *
 * L'ordre des icônes `icon_menu01..06` suit celui du bandeau ; le rattachement d'une icône à un
 * onglet précis n'est pas établi par les fichiers — c'est un ordre d'affichage, pas une preuve.
 * Les libellés sont ceux que le jeu affiche sous l'onglet actif, tirés de sa table de texte.
 */
const ONGLETS = [
	{ cle: "modeles", icone: "icon_menu01", libelle: "Modèles" },
	{ cle: "physionomie", icone: "icon_menu02", libelle: "Physionomie" },
	{ cle: "visage", icone: "icon_menu03", libelle: "Visage et coupe de cheveux" },
	{ cle: "tenue", icone: "icon_menu04", libelle: "Tenue" },
	{ cle: "stats", icone: "icon_menu05", libelle: "Stats" },
	{ cle: "nom", icone: "icon_menu06", libelle: "Nom" },
] as const;

type Onglet = (typeof ONGLETS)[number]["cle"];

/** Libellé d'une catégorie : le préfixe commun de ses ressources, ou son numéro. */
function libelleCategorie(c: Categorie): string {
	const p = c.prefixe.replace(/_+$/, "");
	return p && p !== "?" ? p : `catégorie ${c.faceSettingType}`;
}

/** Titre rendu dans la police du jeu (atlas bitmap composé côté serveur). */
function TitrePolice({ texte, cdn, hauteur }: { texte: string; cdn: string; hauteur: number }) {
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={`${cdn}/ui/text.png?t=${encodeURIComponent(texte)}&fg=FFFFFF`}
			alt={texte}
			style={{ height: `${hauteur}%` }}
			className="w-auto object-contain"
		/>
	);
}

export function GameScreen({ catalogue, cdn }: { catalogue: Catalogue; cdn: string }) {
	const [onglet, setOnglet] = useState<Onglet>("visage");
	const categories = useMemo(
		() => catalogue.categories.filter((c) => c.parts.length > 0),
		[catalogue.categories],
	);
	/** Index de la rubrique sélectionnée dans la colonne de gauche. */
	const [rubrique, setRubrique] = useState(0);
	const [choix, setChoix] = useState<Record<number, string>>({});

	// La colonne affiche les rubriques du jeu ; la grille montre les parts d'une catégorie
	// technique. Les deux listes ne sont PAS appariées par les fichiers : on prend celle de
	// même rang, et on l'affiche comme tel.
	const rubriques = catalogue.rubriques.length > 0 ? catalogue.rubriques : null;
	const active = categories[Math.min(rubrique, categories.length - 1)];

	const iconeUrl = (part: Part) =>
		part.icone ? `${cdn}/avatar/icon/${part.icone}.png` : null;

	return (
		<div className="space-y-3">
			<div
				className="relative w-full overflow-hidden bg-[#246AC2]"
				style={{ aspectRatio: "16 / 9" }}
			>
				{/* Fond : le sprite réel de l'écran, décodé du CPK du jeu. */}
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={`${cdn}${FOND}`}
					alt=""
					className="absolute inset-0 size-full object-cover"
					aria-hidden
				/>

				{/* Bandeau supérieur */}
				<div
					className="absolute inset-x-0 top-0 flex items-center"
					style={{
						height: `${GEOMETRIE.bandeauH}%`,
						background: `linear-gradient(90deg, ${COULEURS.bandeauGauche} 0%, ${COULEURS.bandeauDroite} 100%)`,
					}}
				>
					<span className="ml-[8%] flex h-full items-center">
						<TitrePolice texte="Editeur d'avatar" cdn={cdn} hauteur={42} />
					</span>
					{ONGLETS.map((o, i) => (
						<button
							key={o.cle}
							type="button"
							onClick={() => setOnglet(o.cle)}
							title={o.libelle}
							className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition"
							style={{ left: `${GEOMETRIE.ongletsX[i]}%`, height: "58%" }}
						>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img
								src={`${cdn}${CDN_ATLAS_ONGLETS}/${o.icone}_${onglet === o.cle ? "on" : "off"}.png`}
								alt={o.libelle}
								className="size-full object-contain"
							/>
						</button>
					))}
				</div>

				{/* Languette du libellé sous l'onglet actif */}
				{(() => {
					const i = ONGLETS.findIndex((o) => o.cle === onglet);
					const o = ONGLETS[i];
					if (!o) return null;
					return (
						<div
							className="absolute -translate-x-1/2 rounded-b-2xl px-[1.2vw] py-[0.4vw] text-center"
							style={{
								left: `${GEOMETRIE.ongletsX[i]}%`,
								top: `${GEOMETRIE.bandeauH}%`,
								backgroundColor: COULEURS.languette,
							}}
						>
							<span className="whitespace-nowrap text-[1.1vw] font-medium text-white">
								{o.libelle}
							</span>
						</div>
					);
				})()}

				{/* Rappel du code d'avatar, à la place qu'il occupe dans le jeu */}
				<span
					className="absolute text-[1vw] text-white/95 drop-shadow"
					style={{ left: `${GEOMETRIE.colonneX}%`, top: `${GEOMETRIE.bandeauH + 1.5}%` }}
				>
					Entrer le code d'avatar
				</span>

				{/* Colonne des rubriques */}
				{onglet === "visage" &&
					(rubriques ?? []).slice(0, 10).map((r, i) => {
						const choisie = i === rubrique;
						return (
							<button
								key={r.hash}
								type="button"
								onClick={() => setRubrique(i)}
								className="absolute flex items-center rounded-r-[1.2vw] pl-[2.5%] text-left transition"
								style={{
									left: `${GEOMETRIE.colonneX}%`,
									width: `${GEOMETRIE.colonneW}%`,
									top: `${GEOMETRIE.rubriqueY + i * GEOMETRIE.rubriquePas}%`,
									height: `${GEOMETRIE.rubriqueH}%`,
									backgroundColor: "#FFFFFF",
									boxShadow: choisie ? `0 0 0 0.25vw ${COULEURS.languette}` : "none",
								}}
							>
								<span
									className="truncate text-[1.15vw] font-semibold"
									style={{ color: COULEURS.texteRubrique }}
								>
									{r.libelle}
								</span>
							</button>
						);
					})}

				{/* Panneau de droite : la grille de vignettes */}
				{onglet === "visage" && active && (
					<div
						className="absolute overflow-hidden rounded-[1.5vw] bg-white/95"
						style={{
							left: `${GEOMETRIE.panneauX}%`,
							top: `${GEOMETRIE.panneauY}%`,
							width: `${GEOMETRIE.panneauW}%`,
							height: `${GEOMETRIE.panneauH}%`,
						}}
					>
						<p
							className="border-l-[0.35vw] px-[1vw] py-[0.6vw] text-[1.15vw] font-semibold"
							style={{ borderColor: COULEURS.languette, color: COULEURS.texteRubrique }}
						>
							{libelleCategorie(active)}
						</p>
						<div className="grid h-[86%] grid-cols-3 gap-[0.6vw] overflow-y-auto px-[1vw] pb-[1vw]">
							{active.parts.map((p, i) => {
								const url = iconeUrl(p);
								const choisie = choix[active.faceSettingType] === p.id;
								return (
									<button
										key={`${p.id}-${p.itemNo}`}
										type="button"
										onClick={() =>
											setChoix((c) => ({
												...c,
												[active.faceSettingType]: choisie ? "" : p.id,
											}))
										}
										title={p.resource || p.resourceHash}
										className="relative flex flex-col items-center justify-start rounded-[0.8vw] transition"
										style={{
											boxShadow: choisie ? `0 0 0 0.2vw ${COULEURS.languette}` : "none",
										}}
									>
										<span
											className="self-start pl-[0.4vw] text-[1.1vw] font-bold tabular-nums"
											style={{ color: "#9AA6B2" }}
										>
											{String(i + 1).padStart(2, "0")}
										</span>
										{url ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={url}
												alt={p.resource || ""}
												className="aspect-square w-full object-contain"
											/>
										) : (
											<span className="flex aspect-square w-full items-center justify-center text-[0.8vw] text-[#9AA6B2]">
												sans icône
											</span>
										)}
									</button>
								);
							})}
						</div>
					</div>
				)}

				{/* Volets non couverts par les données de cet écran : on le dit, on ne feint pas. */}
				{onglet !== "visage" && (
					<div
						className="absolute rounded-[1.5vw] bg-white/95 p-[1.5vw]"
						style={{
							left: `${GEOMETRIE.panneauX}%`,
							top: `${GEOMETRIE.panneauY}%`,
							width: `${GEOMETRIE.panneauW}%`,
						}}
					>
						<p className="text-[1.1vw]" style={{ color: COULEURS.texteRubrique }}>
							{ONGLETS.find((o) => o.cle === onglet)?.libelle}
						</p>
						<p className="mt-[0.5vw] text-[0.95vw] text-[#5A6673]">
							Cet onglet n'est pas reconstruit : ses écrans existent dans le jeu, mais leur
							disposition ne se trouve pas dans les fichiers. Les données correspondantes sont
							sous l'écran.
						</p>
					</div>
				)}

				{/* Barre de contrôles du bas */}
				<div
					className="
       absolute inset-x-0 bottom-0 flex items-center justify-center gap-[2vw] py-[0.6vw] text-[1vw] font-medium
     "
					style={{ color: COULEURS.texteRubrique, backgroundColor: `${COULEURS.barreBas}CC` }}
				>
					<span>Choisir</span>
					<span>Zoom</span>
					<span>Tourner</span>
					<span>Expression</span>
					<span>Modèle</span>
				</div>
			</div>

			<p className="text-xs italic text-on-surface-variant">
				Reconstruction avec les assets du jeu : fond, icônes d'onglet, vignettes et police sont
				décodés de ses fichiers ; couleurs et proportions sont mesurées sur des captures. Aucune
				comparaison image à image n'a été faite — ce n'est donc pas une conformité au pixel.
			</p>
		</div>
	);
}
