"use client";

/**
 * L'éditeur, côté navigateur.
 *
 * Il suit la disposition du jeu — des onglets en haut, la liste des catégories à gauche, la
 * grille de vignettes à droite — parce que c'est la disposition que les données imposent : une
 * catégorie porte une plage de parts et une palette de couleurs, et chaque part porte une icône.
 *
 * Ce qu'il ne prétend pas faire : reconstituer l'avatar en 3D. Assembler un visage demande de
 * charger les `g4md`/`g4mg` de chaque part, de composer l'atlas de visage et d'appliquer les
 * matrices d'os — c'est le travail du moteur, pas d'une page. La sélection est donc rendue par
 * ses vignettes réelles et par sa **recette**, la même représentation que le jeu utilise en
 * interne pour décrire un avatar.
 */

import Image from "next/image";
import { useMemo, useState } from "react";
import type { Catalogue, Categorie, Part } from "./types";

/** Les cinq volets, calqués sur ce que les données couvrent réellement. */
const VOLETS = [
	{ cle: "visage", label: "Visage et parts", icone: "face" },
	{ cle: "physionomie", label: "Physionomie", icone: "accessibility_new" },
	{ cle: "presets", label: "Visages prédéfinis", icone: "auto_awesome" },
	{ cle: "identite", label: "Personnalité et voix", icone: "badge" },
	{ cle: "code", label: "Code de partage", icone: "qr_code_2" },
] as const;

type Volet = (typeof VOLETS)[number]["cle"];

/** Libellé d'une catégorie : son préfixe de ressources, ou son numéro s'il n'y en a pas. */
function libelleCategorie(c: Categorie): string {
	const p = c.prefixe.replace(/_+$/, "");
	return p && p !== "?" ? p : `catégorie ${c.faceSettingType}`;
}

/** Vignette d'une part — l'icône réelle du jeu, ou un cadre vide quand le hash n'est pas résolu. */
function Vignette({
	part,
	cdn,
	choisie,
	onClick,
}: {
	part: Part;
	cdn: string;
	choisie: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			title={part.resource || part.resourceHash}
			className={`
     group flex flex-col items-center gap-1 rounded-2xl border p-2 transition
     ${
				choisie
					? "border-primary bg-primary-container"
					: `
       border-outline-variant bg-surface-container-low
       hover:border-primary
     `
			}
   `}
		>
			<span className="relative block size-16 overflow-hidden rounded-xl bg-surface-container">
				{part.icone ? (
					<Image
						src={`${cdn}/avatar/icon/${part.icone}.png`}
						alt={part.resource || part.icone}
						width={64}
						height={64}
						unoptimized
						className="size-full object-contain"
					/>
				) : (
					<span className="flex size-full items-center justify-center text-[10px] text-on-surface-variant">
						sans icône
					</span>
				)}
			</span>
			<span className="max-w-[5.5rem] truncate text-[11px] text-on-surface-variant">
				{part.resource || `#${part.itemNo}`}
			</span>
		</button>
	);
}

export function AvatarEditor({ catalogue, cdn }: { catalogue: Catalogue; cdn: string }) {
	const [volet, setVolet] = useState<Volet>("visage");
	// Les catégories qui ont au moins une part : les autres n'ont rien à montrer.
	const categories = useMemo(
		() => catalogue.categories.filter((c) => c.parts.length > 0),
		[catalogue.categories],
	);
	const [categorie, setCategorie] = useState(categories[0]?.faceSettingType ?? 0);
	/** Sélection courante : catégorie → identifiant de part. */
	const [choix, setChoix] = useState<Record<number, string>>({});
	const [morphologie, setMorphologie] = useState(catalogue.modelesDeBase.morphologies[0] ?? "male");
	const [preset, setPreset] = useState<string | null>(null);

	const active = categories.find((c) => c.faceSettingType === categorie) ?? categories[0];
	const partsChoisies = useMemo(
		() =>
			categories
				.map((c) => {
					const id = choix[c.faceSettingType];
					const part = id ? c.parts.find((p) => p.id === id) : undefined;
					return part ? { categorie: c, part } : null;
				})
				.filter((x): x is { categorie: Categorie; part: Part } => x !== null),
		[categories, choix],
	);

	return (
		<div className="space-y-4">
			{/* Onglets */}
			<nav className="flex flex-wrap gap-2">
				{VOLETS.map((v) => (
					<button
						key={v.cle}
						type="button"
						onClick={() => setVolet(v.cle)}
						className={`
        rounded-full px-4 py-2 text-sm font-medium transition
        ${
							volet === v.cle
								? "bg-primary text-on-primary"
								: `
          bg-surface-container-low text-on-surface-variant
          hover:bg-surface-container
        `
						}
      `}
					>
						{v.label}
					</button>
				))}
			</nav>

			{volet === "visage" && active && (
				<div className="
      grid gap-4
      lg:grid-cols-[16rem_1fr]
    ">
					{/* Colonne des catégories */}
					<aside className="space-y-1">
						{categories.map((c) => (
							<button
								key={c.faceSettingType}
								type="button"
								onClick={() => setCategorie(c.faceSettingType)}
								className={`
          flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-2 text-left text-sm transition
          ${
									c.faceSettingType === categorie
										? "bg-primary-container text-on-primary-container"
										: `
            bg-surface-container-low text-on-surface-variant
            hover:bg-surface-container
          `
								}
        `}
							>
								<span className="truncate font-medium">{libelleCategorie(c)}</span>
								<span className="text-xs tabular-nums opacity-70">{c.parts.length}</span>
							</button>
						))}
					</aside>

					{/* Grille de vignettes + palette */}
					<section className="space-y-4">
						<header className="flex flex-wrap items-baseline justify-between gap-2">
							<h2 className="text-lg font-bold text-on-surface">{libelleCategorie(active)}</h2>
							<p className="text-xs text-on-surface-variant">
								{active.parts.length} parts · {active.couleurs.length} couleurs · catégorie{" "}
								{active.faceSettingType}
							</p>
						</header>

						<div className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2">
							{active.parts.map((p) => (
								<Vignette
									key={`${p.id}-${p.itemNo}`}
									part={p}
									cdn={cdn}
									choisie={choix[active.faceSettingType] === p.id}
									onClick={() =>
										setChoix((c) => ({
											...c,
											[active.faceSettingType]: c[active.faceSettingType] === p.id ? "" : p.id,
										}))
									}
								/>
							))}
						</div>

						{active.couleurs.length > 0 && (
							<div className="space-y-2 rounded-2xl border border-outline-variant bg-surface-container-low p-4">
								<p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
									Palette · {active.couleurs.length} couleurs
								</p>
								{/* Les couleurs sont des CRC-32 de noms de presets de couleur : le jeu ne stocke
								    pas la valeur RVB dans ce fichier. On montre donc les identifiants, sans
								    inventer de teinte qui serait fausse. */}
								<div className="flex flex-wrap gap-1">
									{active.couleurs.map((c) => (
										<span
											key={c}
											className="rounded-lg bg-surface-container px-2 py-1 font-mono text-[10px] text-on-surface-variant"
										>
											{c}
										</span>
									))}
								</div>
							</div>
						)}
					</section>
				</div>
			)}

			{volet === "physionomie" && (
				<div className="space-y-4">
					<div className="flex flex-wrap gap-2">
						{catalogue.modelesDeBase.morphologies.map((m) => (
							<button
								key={m}
								type="button"
								onClick={() => setMorphologie(m)}
								className={`
          rounded-2xl px-4 py-2 text-sm transition
          ${
									m === morphologie
										? "bg-primary-container text-on-primary-container"
										: `
            bg-surface-container-low text-on-surface-variant
            hover:bg-surface-container
          `
								}
        `}
							>
								{m}
							</button>
						))}
					</div>
					<p className="text-sm text-on-surface-variant">
						Chaque type de visage et chaque accessoire existe en une version par morphologie. Pour{" "}
						<strong>{morphologie}</strong> :
					</p>
					<div className="
       grid gap-2
       sm:grid-cols-2
       lg:grid-cols-3
     ">
						{catalogue.modelesDeBase.visages.slice(0, 24).map((v, i) => {
							const idx = catalogue.modelesDeBase.morphologies.indexOf(morphologie);
							return (
								<div
									key={`${v.noseType}-${i}`}
									className="rounded-2xl border border-outline-variant bg-surface-container-low p-3 text-sm"
								>
									<p className="font-medium text-on-surface">{v.noseType}</p>
									<p className="font-mono text-xs text-on-surface-variant">
										{v.resources[idx] ?? "—"}
									</p>
								</div>
							);
						})}
					</div>
					<div className="space-y-2">
						<h3 className="text-sm font-bold text-on-surface">
							Curseurs de morphing applicables à cette morphologie
						</h3>
						{catalogue.curseurs.map((g) => {
							const applicables = g.params.filter((p) => p.morphologies.includes(morphologie));
							if (applicables.length === 0) return null;
							return (
								<details
									key={g.partsType}
									className="rounded-2xl border border-outline-variant bg-surface-container-low p-3"
								>
									<summary className="cursor-pointer text-sm text-on-surface">
										Type de part {g.partsType} — {applicables.length} curseurs
									</summary>
									<ul className="mt-2 space-y-1 text-xs text-on-surface-variant">
										{applicables.slice(0, 40).map((p, i) => (
											<li key={`${p.part}-${p.axe}-${i}`} className="font-mono">
												axe {p.axe} · défaut {p.defaut} · [{p.min} … {p.max}]
											</li>
										))}
									</ul>
								</details>
							);
						})}
					</div>
				</div>
			)}

			{volet === "presets" && (
				<div className="
      grid gap-4
      lg:grid-cols-[18rem_1fr]
    ">
					<aside className="space-y-1">
						{catalogue.presets.map((p) => (
							<button
								key={p.presetID}
								type="button"
								onClick={() => setPreset(p.presetID)}
								className={`
          flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-2 text-left text-sm transition
          ${
									p.presetID === preset
										? "bg-primary-container text-on-primary-container"
										: `
            bg-surface-container-low text-on-surface-variant
            hover:bg-surface-container
          `
								}
        `}
							>
								<span className="truncate">{p.nom ?? p.presetID}</span>
								<span className="text-xs tabular-nums opacity-70">{p.recette.length}</span>
							</button>
						))}
					</aside>
					<section>
						{(() => {
							const p = catalogue.presets.find((x) => x.presetID === preset);
							if (!p)
								return (
									<p className="text-sm italic text-on-surface-variant">
										Choisissez un visage prédéfini pour voir sa recette.
									</p>
								);
							return (
								<div className="space-y-3">
									<header>
										<h2 className="text-lg font-bold text-on-surface">{p.nom ?? p.presetID}</h2>
										<p className="text-xs text-on-surface-variant">
											{p.recette.length} lignes · morphologies :{" "}
											{p.morphologies.length === 8 ? "toutes" : p.morphologies.join(", ")}
										</p>
									</header>
									<div className="overflow-x-auto rounded-2xl border border-outline-variant">
										<table className="w-full text-left text-xs">
											<thead className="bg-surface-container-low text-on-surface-variant">
												<tr>
													<th className="px-3 py-2">Emplacement</th>
													<th className="px-3 py-2">Valeur</th>
													<th className="px-3 py-2">Couleur</th>
													<th className="px-3 py-2">Part</th>
												</tr>
											</thead>
											<tbody className="text-on-surface">
												{p.recette.map((l, i) => (
													<tr key={`${l.emplacement}-${i}`} className="border-t border-outline-variant">
														<td className="px-3 py-1.5 tabular-nums">{l.emplacement}</td>
														<td className="px-3 py-1.5 tabular-nums">{l.valeur}</td>
														<td className="px-3 py-1.5 tabular-nums">
															{l.couleur < 0 ? "—" : l.couleur}
														</td>
														<td className="px-3 py-1.5 font-mono">{l.part ?? "—"}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>
							);
						})()}
					</section>
				</div>
			)}

			{volet === "identite" && (
				<div className="
      grid gap-4
      lg:grid-cols-2
    ">
					<section className="space-y-2">
						<h2 className="text-sm font-bold text-on-surface">
							Personnalités ({catalogue.personnalites.length})
						</h2>
						<p className="text-xs text-on-surface-variant">
							Les libellés viennent de <code>menu_text</code>, la table de texte du jeu.
						</p>
						<ul className="space-y-1">
							{catalogue.personnalites.map((p) => (
								<li
									key={p.type}
									className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2 text-sm"
								>
									<span className="text-on-surface">{p.libelle ?? `type ${p.type}`}</span>
									<span className="text-xs text-on-surface-variant">
										présentation {p.presentation}
									</span>
								</li>
							))}
						</ul>
					</section>
					<section className="space-y-2">
						<h2 className="text-sm font-bold text-on-surface">Voix ({catalogue.voix.length})</h2>
						<p className="text-xs text-on-surface-variant">
							Chaque voix est une banque de sons du jeu, proposée selon le genre et la
							personnalité.
						</p>
						<div className="max-h-96 space-y-1 overflow-y-auto pr-1">
							{catalogue.voix.map((v) => (
								<div
									key={v.banque}
									className="flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-1.5 text-xs"
								>
									<span className="font-mono text-on-surface">{v.banque}</span>
									<span className="text-on-surface-variant">
										genre {v.genre} · personnalité {v.personnalite} · ton {v.ton}
									</span>
								</div>
							))}
						</div>
					</section>
				</div>
			)}

			{volet === "code" && (
				<div className="space-y-3">
					<p className="text-sm text-on-surface-variant">
						Le jeu permet de partager un avatar sous forme de code (« Entrer le code d'avatar »).
						La recette est sérialisée en {catalogue.codePartage.bits} bits — un champ par
						emplacement, de largeur fixe — puis découpée en groupes de 6 bits indexant un alphabet
						de {catalogue.codePartage.alphabet.length} caractères.{" "}
						<strong>L'ordre exact des bits n'est pas prouvé</strong> : il se reverse dans le
						binaire, et rien ici ne prétend encoder ou décoder un vrai code.
					</p>
					<div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4">
						<p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
							Alphabet
						</p>
						<p className="mt-1 break-all font-mono text-sm text-on-surface">
							{catalogue.codePartage.alphabet.join("")}
						</p>
					</div>
					<div className="overflow-x-auto rounded-2xl border border-outline-variant">
						<table className="w-full text-left text-xs">
							<thead className="bg-surface-container-low text-on-surface-variant">
								<tr>
									<th className="px-3 py-2">Emplacement</th>
									<th className="px-3 py-2">Bits</th>
									<th className="px-3 py-2">Valeurs</th>
									<th className="px-3 py-2">Catégorie</th>
									<th className="px-3 py-2">Param</th>
								</tr>
							</thead>
							<tbody className="text-on-surface">
								{catalogue.codePartage.emplacements.map((e) => (
									<tr key={e.emplacement} className="border-t border-outline-variant">
										<td className="px-3 py-1.5 tabular-nums">{e.emplacement}</td>
										<td className="px-3 py-1.5 tabular-nums">{e.bits}</td>
										<td className="px-3 py-1.5 tabular-nums">{e.valeurs}</td>
										<td className="px-3 py-1.5 tabular-nums">{e.categorie}</td>
										<td className="px-3 py-1.5 tabular-nums">
											{e.param}
											{e.paramSub ? ` / ${e.paramSub}` : ""}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{/* Récapitulatif de la sélection : la recette en construction. */}
			{partsChoisies.length > 0 && (
				<footer className="sticky bottom-4 rounded-3xl border border-outline-variant bg-surface-container p-4 shadow-lg">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
							Sélection · {partsChoisies.length} parts
						</p>
						<button
							type="button"
							onClick={() => setChoix({})}
							className="
         rounded-full bg-surface-container-low px-3 py-1 text-xs text-on-surface-variant
         hover:bg-surface-container-high
       "
						>
							Tout effacer
						</button>
					</div>
					<div className="mt-2 flex flex-wrap gap-2">
						{partsChoisies.map(({ categorie: c, part }) => (
							<span
								key={c.faceSettingType}
								className="flex items-center gap-2 rounded-xl bg-surface-container-low px-2 py-1 text-xs"
							>
								{part.icone && (
									<Image
										src={`${cdn}/avatar/icon/${part.icone}.png`}
										alt=""
										width={24}
										height={24}
										unoptimized
										className="size-6 rounded"
									/>
								)}
								<span className="text-on-surface-variant">{libelleCategorie(c)}</span>
								<span className="font-mono text-on-surface">{part.resource || part.id}</span>
							</span>
						))}
					</div>
				</footer>
			)}
		</div>
	);
}
