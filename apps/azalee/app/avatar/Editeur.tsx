"use client";

/**
 * L'éditeur d'avatar du jeu, monté avec ses propres éléments.
 *
 * ## Règle de composition
 *
 * Tout ce qui s'affiche ici existe dans le jeu : ses sprites, sa police, ses libellés, ses voix.
 * Pas d'identifiant technique, pas de compte, pas de hachage, pas d'icône de bibliothèque web.
 * Un élément absent du jeu est absent d'ici.
 *
 * | élément | sprite du jeu |
 * |---|---|
 * | fond | `avatar01_00` |
 * | onglets | `icon_menu0N_{on,off}` (atlas `mainmenu90_02_2`) |
 * | languette | `edit_type_base01` |
 * | plaques | `list_base01_{on,off}` + `icon_edit_listNN_{on,off}` |
 * | panneau | `edit_win_base01` |
 * | vignette | `preset_list01`, sélection `preset_list01_ol`, validation `edit_check01` |
 * | curseur | `edit_bar_base02_{on,off}`, `edit_bar_gauge01_{on,off}` |
 * | page | `icon_menu_arrow01` |
 * | textes | police bitmap du jeu, composée par `/ui/text.png` |
 * | voix | banques `sound_asset/<locale>/<banque>.acb`, décodées par `/audio/…` |
 *
 * Les sprites sont **pré-décodés** dans le dump disque et servis en statique : les décoder à la
 * volée passait par le décodeur live, qui rend 502 pendant les redémarrages du service.
 *
 * ## Géométrie
 *
 * Relevée sur des captures du jeu (2560×1440) : bandeau jusqu'à y = 163 ; plaques de rubrique de
 * x = 34 à 533, première à y = 294, hauteur 71, pas 90,5 ; panneau de x = 1614 à 2470, y = 262 à
 * 1281. Le layout runtime de cet écran ne peut pas servir de source : ses transforms sont un
 * repli qui sort du canevas, la position des widgets ne vivant pas dans les fichiers du jeu.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import CharacterModelViewer from "@/components/wiki/CharacterModelViewer";

import { definirPhotoDepuisAvatar } from "./actions";
import type { Catalogue, Categorie, Part } from "./types";

/** Proportions relevées sur les captures, en pourcentage du cadre. */
const G = {
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
	ongletsX: [50, 56.8, 63.5, 70.2, 77, 83.8],
} as const;

/** Teintes échantillonnées sur les captures. */
const C = { bandeauGauche: "#0EAFFF", bandeauDroite: "#1067F8", texte: "047AFF" } as const;

const A01 = "/dx11/menu/161_avatar/avatar01";
const MM = "/dx11/menu/100_mainmenu/mainmenu90/mainmenu90_02_2";
/** Atlas d'interface communs à tous les écrans (barre de commandes, bouton de retour). */
const CMN = "/dx11/menu/20_cmn";
const S = {
	fond: `${A01}/avatar01_00/avatar01_00.png`,
	// Boutons de catégorie du jeu (428×144, trois états) — `list_base01` (392×72) servait
	// auparavant, mais c'est la plaque des listes internes, pas celle de la colonne.
	plaqueOn: `${A01}/avatar01_26/category_btn_on_l.png`,
	plaqueOff: `${A01}/avatar01_26/category_btn_off_l.png`,
	plaqueSurvol: `${A01}/avatar01_26/category_btn_ol_l.png`,
	voixOff: `${A01}/avatar01_48/voice_base01_off.png`,
	voixOn: `${A01}/avatar01_48/voice_base01_on.png`,
	iconeSon: `${A01}/avatar01_48/icon_sound01.png`,
	retour: `${CMN}/cmn03/cmn03_01/cmd_back_base01.png`,
	cmdOff: `${CMN}/cmn03/cmn03_02/cmd_btn_base01_off.png`,
	cmdOn: `${CMN}/cmn03/cmn03_02/cmd_btn_base01_on.png`,
	valider: `${CMN}/cmn03/cmn03_03/cmd_press_btn_base_on01.png`,
	flecheG: `${A01}/avatar01_11/arrow01_l.png`,
	flecheD: `${A01}/avatar01_11/arrow01_r.png`,
	languette: `${A01}/avatar01_03/edit_type_base01.png`,
	panneau: `${A01}/avatar01_10/edit_win_base01.png`,
	cadre: `${A01}/avatar01_17/preset_list01.png`,
	cadreChoisi: `${A01}/avatar01_17/preset_list01_ol.png`,
	coche: `${A01}/avatar01_17/edit_check01.png`,
	barreOff: `${A01}/avatar01_13/edit_bar_base02_off.png`,
	barreOn: `${A01}/avatar01_13/edit_bar_base02_on.png`,
	jaugeFond: `${A01}/avatar01_13/edit_bar_gauge_base01.png`,
	jauge: `${A01}/avatar01_13/edit_bar_gauge01_on.png`,
	fleche: `${MM}/icon_menu_arrow01.png`,
} as const;

/** Les six onglets du bandeau, avec le libellé que le jeu affiche dessous. */
const ONGLETS = [
	{ cle: "modeles", icone: "icon_menu01", libelle: "Modèles" },
	{ cle: "physionomie", icone: "icon_menu02", libelle: "Physionomie" },
	{ cle: "visage", icone: "icon_menu03", libelle: "Visage et coupe de cheveux" },
	{ cle: "tenue", icone: "icon_menu04", libelle: "Tenue" },
	{ cle: "stats", icone: "icon_menu05", libelle: "Stats" },
	{ cle: "nom", icone: "icon_menu06", libelle: "Nom" },
] as const;

type Onglet = (typeof ONGLETS)[number]["cle"];

/** Neuf vignettes par page, comme la grille du jeu. */
const PAR_PAGE = 9;

/** Un texte composé dans la police du jeu. */
function Txt({
	t,
	cdn,
	couleur = C.texte,
	h,
	className,
}: {
	t: string;
	cdn: string;
	couleur?: string;
	h: string;
	className?: string;
}) {
	if (!t) return null;
	return (
		// eslint-disable-next-line @next/next/no-img-element
		<img
			src={`${cdn}/ui/text.png?t=${encodeURIComponent(t)}&fg=${couleur}`}
			alt={t}
			style={{ height: h }}
			className={`
     w-auto max-w-full object-contain
     ${className ?? ""}
   `}
		/>
	);
}

/** Le panneau de droite du jeu, sur son sprite. */
function Panneau({
	cdn,
	titre,
	children,
}: {
	cdn: string;
	titre: string;
	children: React.ReactNode;
}) {
	return (
		<div
			className="absolute"
			style={{
				left: `${G.panneauX}%`,
				top: `${G.panneauY}%`,
				width: `${G.panneauW}%`,
				height: `${G.panneauH}%`,
			}}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={`${cdn}${S.panneau}`}
				alt=""
				className="absolute inset-0 size-full"
				aria-hidden
			/>
			<div className="relative flex h-full flex-col px-[6%] py-[4%]">
				<Txt t={titre} cdn={cdn} h="7%" className="mb-[3%] shrink-0" />
				{children}
			</div>
		</div>
	);
}

/** Une plaque du jeu, cliquable, avec son libellé. */
function Plaque({
	cdn,
	libelle,
	choisie,
	onClick,
	hauteur = "9%",
}: {
	cdn: string;
	libelle: string;
	choisie: boolean;
	onClick: () => void;
	hauteur?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="relative mb-[1.5%] flex w-full shrink-0 items-center"
			style={{ height: hauteur, minHeight: "2.1vw" }}
		>
			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img
				src={`${cdn}${choisie ? S.plaqueOn : S.plaqueOff}`}
				alt=""
				className="absolute inset-0 size-full"
				aria-hidden
			/>
			<Txt t={libelle} cdn={cdn} h="52%" className="relative ml-[6%]" />
		</button>
	);
}

export function Editeur({ catalogue, cdn }: { catalogue: Catalogue; cdn: string }) {
	const [onglet, setOnglet] = useState<Onglet>("visage");
	const [rubrique, setRubrique] = useState(0);
	const [page, setPage] = useState(0);
	const [choix, setChoix] = useState<Record<number, string>>({});
	const [morphologie, setMorphologie] = useState(0);
	const [taille, setTaille] = useState(7);
	const [tenue, setTenue] = useState(0);
	const [personnalite, setPersonnalite] = useState(0);
	const [modele, setModele] = useState(0);
	const [voix, setVoix] = useState<string | null>(null);
	const [enregistrement, demarrerEnregistrement] = useTransition();
	const [messageValidation, setMessageValidation] = useState("Suivant");
	const audio = useRef<HTMLAudioElement | null>(null);

	const categories = useMemo(
		() => catalogue.categories.filter((c) => c.parts.length > 0),
		[catalogue.categories],
	);
	const rubriques = useMemo(() => catalogue.rubriques.slice(0, 10), [catalogue.rubriques]);
	const active: Categorie | undefined = categories[Math.min(rubrique, categories.length - 1)];
	const pages = active ? Math.max(1, Math.ceil(active.parts.length / PAR_PAGE)) : 1;
	const visibles = active ? active.parts.slice(page * PAR_PAGE, page * PAR_PAGE + PAR_PAGE) : [];
	const morphologies = catalogue.modelesDeBase.morphologies;

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

	// Modèle affiché au centre. Le mapping morphologie → ressource n'est pas devine : le
	// catalogue le fournit (`modelesDeBase.visages[].resources`, un modèle par morphologie).
	// Modèle affiché au centre. Priorité à la part choisie : le catalogue donne ses chemins VFS
	// réels, dont on tire le dossier et le nom que sert `/model-edit/`. À défaut, le visage de la
	// morphologie courante — mapping fourni par les données, pas deviné.
	const modeleUrl = useMemo(() => {
		const partChoisie = categories
			.flatMap((c) => c.parts)
			.find((p) => Object.values(choix).includes(p.id));
		const chemin = partChoisie?.modeles.find((m) => m.includes("/20_EDIT/") && m.endsWith(".g4md"));
		if (chemin) {
			const bouts = chemin.split("/20_EDIT/")[1]?.split("/");
			const dossier = bouts?.[0];
			const nom = bouts?.[1]?.replace(/\.g4md$/, "");
			if (dossier && nom) return `${cdn}/model-edit/${dossier}/${nom}.glb`;
		}
		const visage = catalogue.modelesDeBase.visages[0];
		const res = visage?.resources[morphologie] ?? visage?.resources[0];
		return res ? `${cdn}/model-edit/_facebase/${res}.glb` : null;
	}, [catalogue.modelesDeBase.visages, categories, choix, morphologie, cdn]);

	const iOnglet = ONGLETS.findIndex((o) => o.cle === onglet);

	// L'écran est monté dans `document.body` : posé dans le flux de la page, il restait sous la
	// navigation d'azalée, qui le décalait et le rognait. Le défilement est neutralisé pendant
	// l'affichage, comme le jeu qui occupe tout l'écran.
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

	return createPortal(
		<div
			className="fixed inset-0 flex items-center justify-center bg-black"
			style={{ zIndex: 2147483000 }}
		>
			{/* La scène occupe EXACTEMENT le cadre : les proportions ci-dessus sont relevées sur un
			    cadre 16/9 plein, et une mise en boîte à lettres les décalait toutes (bandeau mesuré
			    à 153 px au lieu de 163, soit un facteur 0,94 sur chaque position). */}
			<div className="relative overflow-hidden" style={{ width: "100vw", height: "100vh" }}>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={`${cdn}${S.fond}`}
					alt=""
					className="absolute inset-0 size-full object-cover"
					aria-hidden
				/>

				{/* Le modèle, au centre comme dans le jeu (emprise relevée sur les captures). */}
				{modeleUrl && (
					<div
						className="absolute"
						style={{ left: "26%", top: "13%", width: "34%", height: "84%" }}
					>
						<CharacterModelViewer glbUrl={modeleUrl} name="" inline />
					</div>
				)}

				{/* Bandeau et onglets */}
				<div
					className="absolute inset-x-0 top-0 flex items-center"
					style={{
						height: `${G.bandeauH}%`,
						background: `linear-gradient(90deg, ${C.bandeauGauche} 0%, ${C.bandeauDroite} 100%)`,
					}}
				>
					<span className="ml-[7%] flex h-full items-center">
						<Txt t="Editeur d'avatar" cdn={cdn} couleur="FFFFFF" h="42%" />
					</span>
					{ONGLETS.map((o, i) => (
						<button
							key={o.cle}
							type="button"
							onClick={() => {
								setOnglet(o.cle);
								setPage(0);
							}}
							aria-label={o.libelle}
							className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
							style={{ left: `${G.ongletsX[i]}%`, height: "34%", opacity: onglet === o.cle ? 1 : 0.55 }}
						>
							<Txt t={o.libelle.split(" ")[0] ?? ""} cdn={cdn} couleur="FFFFFF" h="100%" />
						</button>
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
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={`${cdn}${S.languette}`}
							alt=""
							className="absolute inset-0 size-full"
							aria-hidden
						/>
						<Txt
							t={ONGLETS[iOnglet]?.libelle ?? ""}
							cdn={cdn}
							couleur="FFFFFF"
							h="74%"
							className="relative"
						/>
					</div>
				)}

				{/* Colonne des rubriques — onglet Visage */}
				{onglet === "visage" &&
					rubriques.map((r, i) => {
						const on = i === rubrique;
						return (
							<button
								key={r.hash}
								type="button"
								onClick={() => {
									setRubrique(i);
									setPage(0);
								}}
								className="absolute flex items-center"
								style={{
									left: `${G.colonneX}%`,
									width: `${G.colonneW}%`,
									top: `${G.rubriqueY + i * G.rubriquePas}%`,
									height: `${G.rubriqueH}%`,
								}}
							>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={`${cdn}${on ? S.plaqueOn : S.plaqueOff}`}
									alt=""
									className="absolute inset-0 size-full"
									aria-hidden
								/>
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={`${cdn}${A01}/avatar01_02/icon_edit_list${String(i + 1).padStart(2, "0")}_${on ? "on" : "off"}.png`}
									alt=""
									className="relative ml-[5%] h-[60%] w-auto"
								/>
								<Txt t={r.libelle} cdn={cdn} h="44%" className="relative ml-[5%]" />
							</button>
						);
					})}

				{/* Grille de vignettes — onglet Visage */}
				{onglet === "visage" && active && (
					<Panneau cdn={cdn} titre={rubriques[rubrique]?.libelle ?? ""}>
						<div className="grid grow grid-cols-3 grid-rows-3 gap-[3%]">
							{visibles.map((p: Part) => {
								const on = choix[active.faceSettingType] === p.id;
								return (
									<button
										key={`${p.id}-${p.itemNo}`}
										type="button"
										onClick={() =>
											setChoix((c) => ({ ...c, [active.faceSettingType]: on ? "" : p.id }))
										}
										className="relative flex flex-col items-center justify-start"
									>
										{on && (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={`${cdn}${S.cadreChoisi}`}
												alt=""
												className="absolute inset-0 size-full"
												aria-hidden
											/>
										)}
										{p.icone && (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={`${cdn}/avatar/icon/${p.icone}.png`}
												alt=""
												className="relative size-[84%] object-contain"
											/>
										)}
										{on && (
											// eslint-disable-next-line @next/next/no-img-element
											<img
												src={`${cdn}${S.coche}`}
												alt=""
												className="absolute right-[5%] top-[5%] w-[22%]"
											/>
										)}
									</button>
								);
							})}
						</div>
						{pages > 1 && (
							<div className="mt-[3%] flex shrink-0 items-center justify-center gap-[6%]">
								<button
									type="button"
									onClick={() => setPage((n) => (n - 1 + pages) % pages)}
									aria-label="Page précédente"
								>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={`${cdn}${S.flecheG}`}
										alt=""
										className="h-[1.5vw] w-auto"
									/>
								</button>
								<Txt t={`${page + 1} / ${pages}`} cdn={cdn} h="1.1vw" />
								<button
									type="button"
									onClick={() => setPage((n) => (n + 1) % pages)}
									aria-label="Page suivante"
								>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img src={`${cdn}${S.flecheD}`} alt="" className="h-[1.5vw] w-auto" />
								</button>
							</div>
						)}
					</Panneau>
				)}

				{/* Physionomie : morphologie et taille, sur les sprites de curseur du jeu */}
				{onglet === "physionomie" && (
					<Panneau cdn={cdn} titre="Physionomie">
						<div className="grow overflow-y-auto pr-[2%]">
							{morphologies.map((m, i) => (
								<Plaque
									key={m}
									cdn={cdn}
									libelle={`Silhouette ${i + 1}`}
									choisie={i === morphologie}
									onClick={() => setMorphologie(i)}
								/>
							))}
						</div>
						<div className="mt-[3%] shrink-0">
							<Txt t="Taille" cdn={cdn} h="1.1vw" />
							<div className="relative mt-[2%] flex items-center">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={`${cdn}${S.barreOn}`}
									alt=""
									className="absolute inset-0 size-full"
									aria-hidden
								/>
								<button
									type="button"
									onClick={() => setTaille((v) => Math.max(0, v - 1))}
									aria-label="Diminuer"
									className="relative z-10 px-[4%] py-[2%]"
								>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={`${cdn}${S.fleche}`}
										alt=""
										className="h-[1.1vw] w-auto rotate-180"
									/>
								</button>
								<span className="relative z-10 h-[0.7vw] grow overflow-hidden">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={`${cdn}${S.jaugeFond}`}
										alt=""
										className="absolute inset-0 size-full"
										aria-hidden
									/>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img
										src={`${cdn}${S.jauge}`}
										alt=""
										className="absolute inset-y-0 left-0 h-full"
										style={{ width: `${(taille / 14) * 100}%`, objectFit: "fill" }}
									/>
								</span>
								<button
									type="button"
									onClick={() => setTaille((v) => Math.min(14, v + 1))}
									aria-label="Augmenter"
									className="relative z-10 px-[4%] py-[2%]"
								>
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img src={`${cdn}${S.fleche}`} alt="" className="h-[1.1vw] w-auto" />
								</button>
							</div>
						</div>
					</Panneau>
				)}

				{/* Tenue */}
				{onglet === "tenue" && (
					<Panneau cdn={cdn} titre="Tenue">
						<div className="grow overflow-y-auto pr-[2%]">
							{catalogue.tenues.map((t, i) => (
								<Plaque
									key={t.hash}
									cdn={cdn}
									libelle={`Tenue ${i + 1}`}
									choisie={i === tenue}
									onClick={() => setTenue(i)}
								/>
							))}
						</div>
					</Panneau>
				)}

				{/* Stats : personnalité, puis les voix — écoutables */}
				{onglet === "stats" && (
					<Panneau cdn={cdn} titre="Personnalité">
						<div className="grow overflow-y-auto pr-[2%]">
							{catalogue.personnalites.map((p, i) => (
								<Plaque
									key={p.texte}
									cdn={cdn}
									libelle={p.libelle ?? ""}
									choisie={i === personnalite}
									onClick={() => setPersonnalite(i)}
								/>
							))}
							<Txt t="Voix" cdn={cdn} h="1.1vw" className="mb-[2%] mt-[4%]" />
							{catalogue.voix
								.filter((v) => v.personnalite === catalogue.personnalites[personnalite]?.type)
								.map((v) => (
									<button
										key={v.banque}
										type="button"
										onClick={() => jouer(v.banque)}
										className="relative mb-[1.5%] flex h-[9%] min-h-[2.1vw] w-full shrink-0 items-center"
									>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={`${cdn}${voix === v.banque ? S.voixOn : S.voixOff}`}
											alt=""
											className="absolute inset-0 size-full"
											aria-hidden
										/>
										{/* eslint-disable-next-line @next/next/no-img-element */}
										<img
											src={`${cdn}${S.iconeSon}`}
											alt=""
											className="relative ml-[5%] h-[54%] w-auto"
										/>
										<Txt t={`Voix ${v.ton + 1}`} cdn={cdn} h="50%" className="relative ml-[5%]" />
									</button>
								))}
						</div>
					</Panneau>
				)}

				{/* Modèles : les avatars prêts du jeu */}
				{onglet === "modeles" && (
					<Panneau cdn={cdn} titre="Modèles">
						<div className="grow overflow-y-auto pr-[2%]">
							{catalogue.avatarsFichiers.map((a, i) => (
								<Plaque
									key={a.nom}
									cdn={cdn}
									libelle={a.libelle ?? `Modèle ${i + 1}`}
									choisie={i === modele}
									onClick={() => setModele(i)}
								/>
							))}
						</div>
					</Panneau>
				)}

				{/* Barre du bas : retour à gauche, commandes au centre, validation à droite —
				    disposition et sprites relevés sur les captures du jeu. */}
				<div className="absolute inset-x-0 bottom-0 flex items-center justify-between px-[2%] pb-[1%]">
					<button type="button" aria-label="Retour" className="relative h-[4.2%]">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={`${cdn}${S.retour}`} alt="" className="h-full w-auto" />
					</button>

					<div className="flex items-center gap-[1.5vw]">
						{["Choisir", "Zoom", "Tourner", "Expression", "Modèle"].map((c) => (
							<span key={c} className="relative flex items-center">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img
									src={`${cdn}${S.cmdOff}`}
									alt=""
									className="h-[2.4vw] w-auto"
									aria-hidden
								/>
								<span className="absolute inset-0 flex items-center justify-center">
									<Txt t={c} cdn={cdn} h="42%" />
								</span>
							</span>
						))}
					</div>

					{/* Validation : le jeu propose « Suivant ». Ici il applique le visage choisi comme
					    photo du compte connecté (l'identité vient de la session). */}
					<button
						type="button"
						disabled={enregistrement}
						onClick={() => {
							const partChoisie = categories
								.flatMap((c) => c.parts)
								.find((p) => Object.values(choix).includes(p.id));
							if (!partChoisie?.icone) {
								setMessageValidation("Choisis un visage");
								return;
							}
							demarrerEnregistrement(async () => {
								const r = await definirPhotoDepuisAvatar(partChoisie.icone as string);
								setMessageValidation(r.error ? r.error : "Photo enregistrée");
							});
						}}
						className="relative flex items-center"
					>
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img src={`${cdn}${S.valider}`} alt="" className="h-[3vw] w-auto" aria-hidden />
						<span className="absolute inset-0 flex items-center justify-center px-[8%]">
							<Txt t={messageValidation} cdn={cdn} h="38%" />
						</span>
					</button>
				</div>

				{/* Nom : le jeu ouvre un clavier ; ici un champ, sans habillage étranger */}
				{onglet === "nom" && (
					<Panneau cdn={cdn} titre="Nom">
						<input
							type="text"
							maxLength={12}
							placeholder=""
							className="w-full border-0 bg-transparent text-center text-[1.6vw] font-semibold text-[#047AFF] outline-none"
						/>
					</Panneau>
				)}
			</div>
		</div>,
		document.body,
	);
}
