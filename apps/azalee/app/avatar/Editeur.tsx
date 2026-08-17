"use client";

/**
 * L'éditeur d'avatar du jeu, monté avec ses propres éléments.
 *
 * ## Règle de composition
 *
 * Tout ce qui s'affiche ici existe dans le jeu : ses sprites, sa police, ses libellés, ses voix.
 * Pas d'identifiant technique, pas de hachage à l'écran, pas d'icône de bibliothèque web. Un
 * élément absent du jeu est absent d'ici.
 *
 * - les **libellés** viennent de `menu_text` par hachage (`libelles.ts`) ;
 * - la **structure** des écrans vient des `objbin` du jeu (`structure.ts`) ;
 * - les **sprites** viennent des atlas `menu/161_avatar/avatar01`, `menu/20_cmn`, `font/` ;
 * - les **briques** (curseur, vignette, ligne, note) sont dans `ui.tsx` ;
 * - les **panneaux** des six onglets sont dans `panneaux.tsx`.
 *
 * ## Géométrie du cadre
 *
 * Relevée sur les captures du jeu (2560×1440) : bandeau jusqu'à y = 163 ; plaques de rubrique de
 * x = 34 à 533, première à y = 253, hauteur 71, pas 90,5 ; panneau de x = 1583 à 2556, y = 237.
 *
 * La position des widgets EST dans les fichiers du jeu — `nie_formats::menu::attach_slots` la
 * résout depuis les `CMenuAttachLocator`, et le layout exporté place 14 des 18 objets de cet écran
 * dans son canevas. Le relevé sur captures reste utilisé parce que la conversion de ces transforms
 * en coordonnées écran (ancre, échelle, repère) n'est pas encore juste, pas parce que la donnée
 * manquerait. Cf. `/avatar/layout/<ecran>.json`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { definirPhotoDepuisAvatar } from "./actions";
import { H, MORPHOLOGIES, resolveur } from "./libelles";
import { Modele3D } from "./Modele3D";
import {
	CentreStats,
	PanHabits,
	PanNom,
	PanPersonnalite,
	PanPhysionomie,
	PanStatsBase,
	PanStyle,
	PanVisage,
	PanVoix,
	type Contexte,
} from "./panneaux";
import { RUBRIQUES_STATS, RUBRIQUES_VISAGE } from "./structure";
import type { Catalogue } from "./types";
import { A01, BLEU, Curseur, FONT, Sprite, Txt } from "./ui";

/** Proportions relevées sur les captures, en pourcentage du cadre. */
const G = {
	bandeauH: (163 / 1440) * 100,
	colonneX: (34 / 2560) * 100,
	colonneW: ((533 - 34) / 2560) * 100,
	rubriqueY: (253 / 1440) * 100,
	rubriqueH: (71 / 1440) * 100,
	rubriquePas: (90.5 / 1440) * 100,
	panneauX: (1583 / 2560) * 100,
	panneauY: (237 / 1440) * 100,
	panneauW: (973 / 2560) * 100,
	panneauH: ((1281 - 262) / 1440) * 100,
	ongletsX: [50, 56.8, 63.5, 70.2, 77, 83.8],
} as const;

/** Teintes du bandeau, échantillonnées sur les captures. */
const C = { bandeauGauche: "#0EAFFF", bandeauDroite: "#1067F8" } as const;

const CMN = "/dx11/menu/20_cmn";
const MM = "/dx11/menu/100_mainmenu/mainmenu90/mainmenu90_02_2";
const MM2 = "/dx11/menu/100_mainmenu/mainmenu90/mainmenu90_02";
/** Sol du jeu sous le sprite de fond : la couleur de sa dernière ligne opaque. */
const SOL = "#BEF2FC";

/** Les six onglets, dans l'ordre du jeu, avec l'icône et le hachage de leur libellé. */
const ONGLETS = [
	{ cle: "style", icone: "icon_menu_avatar01", hash: H.ongletStyle },
	{ cle: "physionomie", icone: "icon_menu_avatar02", hash: H.ongletPhysionomie },
	{ cle: "visage", icone: "icon_menu_avatar03", hash: H.ongletVisage },
	{ cle: "habits", icone: "icon_menu_avatar04", hash: H.ongletHabits },
	{ cle: "stats", icone: "icon_menu_avatar05", hash: H.ongletStats },
	{ cle: "nom", icone: "icon_menu_avatar06", hash: H.ongletNom },
] as const;

type Onglet = (typeof ONGLETS)[number]["cle"];

/**
 * Les commandes de la barre du bas, par onglet — celles que les captures du jeu montrent.
 *
 * Chaque entrée est `[badge de touche, hachage du libellé]`. Les badges sont les gaiji du jeu
 * (`gaiji_mouse_l`, `gaiji_arrow_ud`, `gaiji_x`…), pas des glyphes de police web.
 */
const COMMANDES: Record<Onglet, [string, string][]> = {
	style: [
		["gaiji_mouse_l", H.choisir],
		["gaiji_arrow_ud", H.zoom],
		["gaiji_arrow_lr", H.tourner],
		["gaiji_n", H.expression],
		["gaiji_v", H.modele],
	],
	physionomie: [
		["gaiji_mouse_l", H.choisir],
		["gaiji_arrow_ud", H.zoom],
		["gaiji_arrow_lr", H.tourner],
		["gaiji_n", H.expression],
		["gaiji_v", H.modele],
	],
	visage: [
		["gaiji_mouse_l", H.choisir],
		["gaiji_arrow_ud", H.zoom],
		["gaiji_arrow_lr", H.tourner],
		["gaiji_n", H.expression],
		["gaiji_x", H.cacherCheveux],
		["gaiji_v", H.modele],
	],
	habits: [
		["gaiji_mouse_l", H.choisir],
		["gaiji_arrow_ud", H.zoom],
		["gaiji_arrow_lr", H.tourner],
		["gaiji_x", H.cacherCheveux],
		["gaiji_v", H.modele],
	],
	stats: [
		["gaiji_mouse_l", H.choisir],
		["gaiji_arrow_ud", H.zoom],
		["gaiji_arrow_lr", H.tourner],
		["gaiji_x", H.apercuPoses],
		["gaiji_v", H.modele],
	],
	nom: [
		["gaiji_mouse_l", H.choisir],
		["gaiji_arrow_ud", H.zoom],
		["gaiji_arrow_lr", H.tourner],
		["gaiji_x", H.voirApparence],
		["gaiji_v", H.modele],
	],
};

export function Editeur({ catalogue, cdn }: { catalogue: Catalogue; cdn: string }) {
	const [onglet, setOnglet] = useState<Onglet>("style");
	const [rubrique, setRubrique] = useState(0);
	const [choix, setChoixBrut] = useState<Record<number, string>>({});
	const [valeurs, setValeursBrut] = useState<Record<string, number>>({});
	const [pages, setPagesBrut] = useState<Record<string, number>>({});
	const [genre, setGenre] = useState(0);
	const [morphologie, setMorphologie] = useState(0);
	const [ligneOuverte, setLigneOuverte] = useState<string | null>(null);
	const [champs, setChampsBrut] = useState<Record<string, string>>({});
	const [voix, setVoix] = useState<string | null>(null);
	const [enregistrement, demarrerEnregistrement] = useTransition();
	const [messageFin, setMessageFin] = useState<string | null>(null);
	const audio = useRef<HTMLAudioElement | null>(null);

	const lib = useMemo(() => resolveur(catalogue), [catalogue]);
	const txt = useCallback((hash: string) => lib(hash)?.libelle ?? "", [lib]);

	const setChoix = useCallback(
		(cat: number, id: string) =>
			setChoixBrut((c) => ({ ...c, [cat]: c[cat] === id ? "" : id })),
		[],
	);
	const setValeur = useCallback(
		(cle: string, v: number) => setValeursBrut((s) => ({ ...s, [cle]: v })),
		[],
	);
	const setPage = useCallback(
		(cle: string, n: number) => setPagesBrut((s) => ({ ...s, [cle]: n })),
		[],
	);
	const setChamp = useCallback(
		(cle: string, v: string) => setChampsBrut((s) => ({ ...s, [cle]: v })),
		[],
	);

	/** Joue une banque de voix du jeu, décodée à la volée. */
	const jouer = useCallback(
		(banque: string) => {
			audio.current?.pause();
			const el = new Audio(`${cdn}/audio/common/sound_asset/en/${banque}.acb`);
			audio.current = el;
			setVoix(banque);
			el.onended = () => setVoix(null);
			void el.play().catch(() => setVoix(null));
		},
		[cdn],
	);

	// Modèle affiché au centre : l'avatar est un EMPILEMENT de pièces, pas un modèle unique. On
	// assemble le visage de la morphologie courante (mapping fourni par le catalogue) avec chaque
	// part choisie qui possède un modèle sous `20_EDIT/`, et `/model-avatar/` rend le GLB combiné.
	const modeleUrl = useMemo(() => {
		const pieces: string[] = [];
		const visage = catalogue.modelesDeBase.visages[0];
		const res = visage?.resources[morphologie] ?? visage?.resources[0];
		if (res) pieces.push(`_facebase/${res}`);

		for (const c of catalogue.categories) {
			const id = choix[c.faceSettingType];
			if (!id) continue;
			const part = c.parts.find((p) => p.id === id);
			const chemin = part?.modeles.find((m) => m.includes("/20_EDIT/") && m.endsWith(".g4md"));
			if (!chemin) continue;
			const bouts = chemin.split("/20_EDIT/")[1]?.split("/");
			const dossier = bouts?.[0];
			const nom = bouts?.[1]?.replace(/\.g4md$/, "");
			if (dossier && nom) pieces.push(`${dossier}/${nom}`);
		}
		if (pieces.length === 0) return null;
		return `${cdn}/model-avatar/${pieces.join("+")}.glb`;
	}, [catalogue.modelesDeBase.visages, catalogue.categories, choix, morphologie, cdn]);

	/** Applique l'avatar composé comme photo du compte : la vignette du visage choisi. */
	const appliquer = useCallback(() => {
		const cat = catalogue.categories.find((c) => c.faceSettingType === 1);
		const id = choix[1];
		const icone =
			cat?.parts.find((p) => p.id === id)?.icone ??
			cat?.parts.find((p) => p.icone)?.icone ??
			null;
		if (!icone) return;
		demarrerEnregistrement(async () => {
			const r = await definirPhotoDepuisAvatar(icone);
			setMessageFin(r.error ?? null);
		});
	}, [catalogue.categories, choix]);

	const ctx: Contexte = {
		cdn,
		catalogue,
		lib,
		txt,
		choix,
		setChoix,
		valeurs,
		setValeur,
		page: pages,
		setPage,
		genre,
		setGenre,
		morphologie,
		setMorphologie,
		rubrique,
		ligneOuverte,
		setLigneOuverte,
	};

	const iOnglet = ONGLETS.findIndex((o) => o.cle === onglet);

	/** Les rubriques de la colonne, selon l'onglet : dix pour le visage, trois pour les stats. */
	const rubriques = useMemo(() => {
		if (onglet === "visage") {
			return catalogue.rubriques
				.slice(0, 10)
				.map((r, i) => ({ ...r, icone: RUBRIQUES_VISAGE[i]?.icone ?? i + 1 }));
		}
		if (onglet === "stats") {
			return catalogue.rubriques
				.slice(10, 13)
				.map((r, i) => ({ ...r, icone: RUBRIQUES_STATS[i]?.icone ?? i + 11 }));
		}
		return [];
	}, [catalogue.rubriques, onglet]);

	// L'écran est monté dans `document.body` : posé dans le flux de la page, il restait sous la
	// navigation d'azalée, qui le décalait et le rognait.
	const [monte, setMonte] = useState(false);
	useEffect(() => {
		setMonte(true);
		const avant = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.body.style.overflow = avant;
		};
	}, []);
	if (!monte) return null;

	/** Le contenu du panneau de droite, selon l'onglet et la rubrique ouverte. */
	const panneau = (() => {
		switch (onglet) {
			case "style":
				return <PanStyle ctx={ctx} />;
			case "physionomie":
				return <PanPhysionomie ctx={ctx} />;
			case "visage":
				return <PanVisage ctx={ctx} />;
			case "habits":
				return <PanHabits ctx={ctx} />;
			case "stats":
				return rubrique === 0 ? (
					<PanStatsBase ctx={ctx} />
				) : rubrique === 1 ? (
					<PanPersonnalite ctx={ctx} />
				) : (
					<PanVoix ctx={ctx} jouer={jouer} enCours={voix} />
				);
			case "nom":
				return <PanNom ctx={ctx} champs={champs} setChamp={setChamp} />;
		}
	})();

	return createPortal(
		<div
			className="flex items-center justify-center"
			style={{
				// `position` et `inset` en style INLINE, pas par classe : la classe utilitaire ne
				// suffisait pas ici — l'élément restait dans le flux et sa hauteur se limitait à son
				// contenu, laissant paraître le fond de la page sous l'écran sur ~80 px.
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				zIndex: 2147483000,
				backgroundImage: `url(${cdn}${A01}/avatar01_00/avatar01_00.png)`,
				backgroundSize: "100% auto",
				backgroundPosition: "top center",
				backgroundRepeat: "no-repeat",
				backgroundColor: SOL,
			}}
		>
			<div className="absolute inset-0 overflow-hidden">
				{/* Le modèle, au centre comme dans le jeu (emprise relevée sur les captures). */}
				{modeleUrl && (
					<div className="absolute" style={{ left: "22%", top: "12%", width: "38%", height: "84%" }}>
						<Modele3D url={modeleUrl} />
					</div>
				)}

				{/* Panneau central des statistiques : le jeu le pose à gauche du panneau de droite,
				    entre le modèle et lui (emprise relevée sur la capture de « Stats de base »). */}
				{onglet === "stats" && rubrique === 0 && (
					<div
						className="absolute"
						style={{ left: "41.4%", top: "18%", width: "19%", height: "70.5%" }}
					>
						<CentreStats ctx={ctx} />
					</div>
				)}

				{/* Bandeau, titre et onglets */}
				<div
					className="absolute inset-x-0 top-0 flex items-center"
					style={{
						height: `${G.bandeauH}%`,
						background: `linear-gradient(90deg, ${C.bandeauGauche} 0%, ${C.bandeauDroite} 100%)`,
					}}
				>
					<span className="ml-[2%] flex h-full shrink-0 items-center gap-[1vw]">
						<Sprite cdn={cdn} src={`${MM2}/icon_header_avatar01.png`} className="h-[62%] w-auto" />
						{/* `max-w-full` rognait le titre ("Éditeur d'avatai") : le texte du jeu est une
						    image, sa largeur doit rester libre. */}
						<Txt
							t={txt(H.titre)}
							cdn={cdn}
							couleur="FFFFFF"
							h="42%"
							className="!max-w-none"
						/>
					</span>

					{/* Badges de bascule d'onglet, aux deux bouts de la rangée, comme le jeu. */}
					<Sprite
						cdn={cdn}
						src={`${FONT}/gaiji_a.png`}
						className="absolute h-[26%] w-auto"
						style={{ left: `${G.ongletsX[0] - 5}%`, top: "38%" }}
					/>
					<Sprite
						cdn={cdn}
						src={`${FONT}/gaiji_e.png`}
						className="absolute h-[26%] w-auto"
						style={{ left: `${G.ongletsX[5] + 5}%`, top: "38%" }}
					/>

					{ONGLETS.map((o, i) => (
						<span key={o.cle}>
							<button
								type="button"
								onClick={() => {
									setOnglet(o.cle);
									setRubrique(0);
									setLigneOuverte(null);
								}}
								aria-label={txt(o.hash)}
								className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
								style={{ left: `${G.ongletsX[i]}%`, height: "58%" }}
							>
								<Sprite
									cdn={cdn}
									src={`${MM}/${o.icone}_${onglet === o.cle ? "on" : "off"}.png`}
									className="size-full object-contain"
								/>
							</button>
							{/* Chevron de séparation entre deux onglets. */}
							{i < ONGLETS.length - 1 && (
								<Sprite
									cdn={cdn}
									src={`${MM}/icon_menu_arrow01.png`}
									className="absolute h-[22%] w-auto"
									style={{
										left: `${(G.ongletsX[i]! + G.ongletsX[i + 1]!) / 2}%`,
										top: "40%",
									}}
								/>
							)}
						</span>
					))}
				</div>

				{/* Languette du libellé de l'onglet actif */}
				{iOnglet >= 0 && (
					<div
						className="absolute flex -translate-x-1/2 items-center justify-center"
						style={{
							left: `${G.ongletsX[iOnglet]}%`,
							top: `${G.bandeauH}%`,
							width: "26%",
							height: "4.2%",
						}}
					>
						<Sprite
							cdn={cdn}
							src={`${A01}/avatar01_03/edit_type_base01.png`}
							className="absolute inset-0 size-full"
						/>
						<Txt
							t={txt(ONGLETS[iOnglet]!.hash)}
							cdn={cdn}
							couleur="FFFFFF"
							h="74%"
							className="relative"
						/>
					</div>
				)}

				{/* Entrée d'un code d'avatar, sous le titre */}
				<span
					className="absolute flex items-center gap-[0.5vw] rounded-r-[0.3vw] bg-[#0B3E86]/70 py-[0.35%] pl-[1%] pr-[1.5%]"
					style={{ left: 0, top: `${G.bandeauH + 1.2}%` }}
				>
					<Sprite cdn={cdn} src={`${FONT}/gaiji_tab.png`} className="h-[1vw] w-auto" />
					<Txt t={txt(H.codeAvatar)} cdn={cdn} couleur="FFFFFF" h="1vw" />
				</span>

				{/* Colonne des rubriques */}
				{rubriques.map((r, i) => {
					const on = i === rubrique;
					return (
						<button
							key={r.hash}
							type="button"
							onClick={() => {
								setRubrique(i);
								setLigneOuverte(null);
							}}
							className="absolute flex items-center"
							style={{
								left: `${G.colonneX}%`,
								width: `${G.colonneW}%`,
								top: `${G.rubriqueY + i * G.rubriquePas}%`,
								height: `${G.rubriqueH}%`,
							}}
						>
							<Sprite
								cdn={cdn}
								src={`${A01}/avatar01_02/list_base01_${on ? "on" : "off"}.png`}
								className="absolute inset-0 size-full"
							/>
							{on && <Curseur cdn={cdn} className="absolute left-[-4%] h-[80%]" />}
							<Sprite
								cdn={cdn}
								src={`${A01}/avatar01_02/icon_edit_list${String(r.icone).padStart(2, "0")}_${on ? "on" : "off"}.png`}
								className="relative ml-[5%] h-[60%] w-auto"
							/>
							<Txt
								t={r.libelle}
								cdn={cdn}
								couleur={on ? "FFFFFF" : BLEU}
								h="44%"
								className="relative ml-[5%]"
							/>
						</button>
					);
				})}

				{/* Panneau de droite */}
				<div
					className="absolute"
					style={{
						left: `${G.panneauX}%`,
						top: `${G.panneauY}%`,
						width: `${G.panneauW}%`,
						height: `${G.panneauH}%`,
					}}
				>
					<Sprite
						cdn={cdn}
						src={`${A01}/avatar01_10/edit_win_base01.png`}
						className="absolute inset-0 size-full"
					/>
					<div className="relative flex h-full flex-col overflow-hidden px-[6%] py-[3%]">
						{panneau}
					</div>
				</div>

				{/* Bandeau d'aide du bas, que le jeu affiche sur l'écran de nom */}
				{onglet === "nom" && (
					<div
						className="absolute inset-x-0 flex items-center bg-[#2A5C93]/55 py-[0.6%] pl-[2%]"
						style={{ bottom: "8.5%" }}
					>
						<Txt t={txt(H.aideNom)} cdn={cdn} couleur="FFFFFF" h="1.1vw" />
					</div>
				)}

				{/* Barre du bas : retour, commandes, validation */}
				<div className="absolute inset-x-0 bottom-0 flex items-center" style={{ height: "8.5%" }}>
					<button type="button" className="relative ml-[1.5%] h-[64%]" aria-label="Retour">
						<Sprite
							cdn={cdn}
							src={`${CMN}/cmn03/cmn03_01/cmd_back_base01.png`}
							className="h-full w-auto"
						/>
					</button>
					<span className="ml-[6%] flex items-center gap-[2.4vw]">
						{COMMANDES[onglet].map(([badge, hash]) => (
							<span key={badge + hash} className="flex items-center gap-[0.5vw]">
								<Sprite cdn={cdn} src={`${FONT}/${badge}.png`} className="h-[1.15vw] w-auto" />
								<Txt t={txt(hash)} cdn={cdn} couleur="FFFFFF" h="1.15vw" />
							</span>
						))}
					</span>
					<button
						type="button"
						onClick={onglet === "nom" ? appliquer : () => {
							const i = ONGLETS.findIndex((o) => o.cle === onglet);
							const suivant = ONGLETS[Math.min(i + 1, ONGLETS.length - 1)];
							if (suivant) {
								setOnglet(suivant.cle);
								setRubrique(0);
							}
						}}
						disabled={enregistrement}
						className="relative ml-auto mr-[1.5%] flex h-[62%] items-center justify-center"
					>
						<Sprite
							cdn={cdn}
							src={`${CMN}/cmn03/cmn03_03/cmd_press_btn_base_on01.png`}
							className="absolute inset-0 size-full"
						/>
						<span className="relative flex items-center gap-[0.6vw] px-[1.4vw]">
							<Sprite cdn={cdn} src={`${FONT}/gaiji_e.png`} className="h-[1.1vw] w-auto" />
							<Txt
								t={txt(onglet === "nom" ? H.termine : H.suivant)}
								cdn={cdn}
								couleur="FFFFFF"
								h="1.25vw"
							/>
						</span>
					</button>
				</div>

				{/* Message d'échec de l'enregistrement, dans la forme des notes du jeu */}
				{messageFin && (
					<div className="
       absolute inset-x-[30%] bottom-[12%] flex items-center gap-[1vw] rounded-[0.3vw] bg-white/90 px-[2%] py-[1%]
     ">
						<Sprite cdn={cdn} src={`${FONT}/gaiji_system02.png`} className="h-[1.6vw] w-auto" />
						<Txt t={messageFin} cdn={cdn} h="1.05vw" />
					</div>
				)}
			</div>
		</div>,
		document.body,
	);
}

/** Les morphologies du jeu, réexportées pour les écrans qui les nomment. */
export { MORPHOLOGIES };
