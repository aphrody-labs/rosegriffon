/**
 * Catalogue produits Rose Griffon — source de vérité côté code.
 *
 * Convention prix : `priceCents` en centimes d'euros (Stripe-native).
 * Chaque produit peut avoir des `variants` (taille, artiste, etc.) qui agissent
 * comme des SKUs séparés au checkout. Si pas de variant, l'achat est direct.
 *
 * Images : référencer un asset déjà présent dans `apps/website/public/`.
 * `tags` servent au filtrage côté UI (chip filter dans /shop).
 */

export type ProductCategory =
	| "pack-patreon"
	| "print"
	| "sticker"
	| "marque-page"
	| "badge"
	| "textile"
	| "affiche"
	| "carte"
	| "digital";

export interface ProductVariant {
	id: string;
	label: string;
	priceCentsOverride?: number;
	image?: string;
}

export interface Product {
	slug: string;
	name: string;
	tagline: string;
	description: string;
	priceCents: number;
	category: ProductCategory;
	image: string;
	gallery?: string[];
	variants?: ProductVariant[];
	tags: string[];
	stockHint?: "in-stock" | "low-stock" | "preorder" | "limited";
	patreonExclusive?: boolean;
	highlights?: string[];
}

export const PRODUCTS: Product[] = [
	{
		slug: "pack-personnage-destin-billows",
		name: "Pack Personnage — Édition Destin Billows",
		tagline: "Édition limitée illustrée par 4 artistes Rose Griffon",
		description:
			"Pack collector autour de Destin Billows : un print A5 signé, un marque-page assorti, un sticker exclusif et un grand badge brodé. Choisissez votre artiste favori parmi Solstice, Ethan, Rayjang ou Pauline — ou prenez le pack complet pour collectionner les 4 visions.",
		priceCents: 2490,
		category: "pack-patreon",
		image: "/patreon/destin.webp",
		gallery: ["/patreon/destin.webp", "/patreon/destin-mobile.webp"],
		variants: [
			{ id: "solstice", label: "Illustration · Solstice" },
			{ id: "ethan", label: "Illustration · Ethan" },
			{ id: "rayjang", label: "Illustration · Rayjang" },
			{ id: "pauline", label: "Illustration · Pauline" },
			{
				id: "complet",
				label: "Pack complet · 4 artistes",
				priceCentsOverride: 7990,
			},
		],
		tags: ["édition limitée", "print", "marque-page", "sticker", "badge"],
		stockHint: "limited",
		highlights: [
			"1 print A5 papier 250g mat",
			"1 marque-page assorti",
			"1 sticker exclusif vinyle découpé",
			"1 grand badge brodé Ø 56mm",
			"Livré sous pochette kraft signée",
		],
	},
	{
		slug: "print-a5-roy-fonteneau",
		name: "Print A5 · Roy Fonteneau",
		tagline: "Trading card style Inazuma TV — défense n°07",
		description:
			"Impression A5 papier mat 250g de la carte personnage Roy Fonteneau, capitaine défensif de Rose Griffon. Diagonale or/marine/rouge signature, citation iconique au verso.",
		priceCents: 990,
		category: "print",
		image: "/RG_roy_LC.webp",
		tags: ["print", "personnage", "Roy"],
		stockHint: "in-stock",
		highlights: [
			"Format A5 (148 × 210 mm)",
			"Papier mat 250g qualité galerie",
			"Citation au verso",
			"Tirage non numéroté",
		],
	},
	{
		slug: "print-a5-gaelle-la-goatte",
		name: "Print A5 · Gaëlle La Goatte",
		tagline: "Portrait signature — milieu de terrain emblématique",
		description:
			"Impression A5 papier mat 250g de Gaëlle La Goatte, le génie créatif de Rose Griffon. Palette vermillon/or, format collector encadrable.",
		priceCents: 990,
		category: "print",
		image: "/gaelle_lagoatte_pfp.webp",
		tags: ["print", "personnage", "Gaëlle"],
		stockHint: "in-stock",
		highlights: [
			"Format A5 (148 × 210 mm)",
			"Papier mat 250g qualité galerie",
			"Couleurs vermillon/or vibrantes",
		],
	},
	{
		slug: "sticker-pack-communaute",
		name: "Sticker Pack · Communauté",
		tagline: "5 stickers chibi vinyle découpé",
		description:
			"Lot de 5 stickers vinyle découpé représentant les emotes Discord les plus iconiques de Rose Griffon. Résistants à l'eau, parfaits sur ordinateur portable, gourde ou cahier.",
		priceCents: 790,
		category: "sticker",
		image: "/emote.webp",
		tags: ["sticker", "emote", "lot"],
		stockHint: "in-stock",
		highlights: [
			"5 stickers chibi exclusifs",
			"Vinyle découpé, finition mat",
			"Résistant à l'eau et aux UV",
			"Format 60–80 mm chaque",
		],
	},
	{
		slug: "sticker-mark-evans",
		name: "Sticker · Mark Evans cœur d'or",
		tagline: "Le mascot officiel de la communauté",
		description:
			"Sticker vinyle découpé du fameux Mark Evans tenant son cœur d'or — l'emote la plus utilisée sur le Discord Rose Griffon.",
		priceCents: 250,
		category: "sticker",
		image: "/emote.webp",
		tags: ["sticker", "Mark Evans"],
		stockHint: "in-stock",
		highlights: ["Vinyle découpé 80 mm", "Résistant eau + UV"],
	},
	{
		slug: "marque-page-trio",
		name: "Pack 3 Marque-pages",
		tagline: "Roy / Gaëlle / Mark — papier mat 350g",
		description:
			"Trio de marque-pages assortis sur les trois figures de la communauté Rose Griffon. Papier mat 350g, pelliculage soft-touch, gland coton.",
		priceCents: 450,
		category: "marque-page",
		image: "/da/staffRG.webp",
		tags: ["marque-page", "lot"],
		stockHint: "in-stock",
		highlights: [
			"3 marque-pages assortis",
			"Papier 350g pelliculage soft-touch",
			"Gland coton coloré",
		],
	},
	{
		slug: "badge-brode-rose-griffon",
		name: "Grand Badge brodé · Rose Griffon",
		tagline: "Logo Griffon × Éclair Inazuma — Ø 56 mm",
		description:
			"Grand badge brodé reprenant le logo Rose Griffon (silhouette griffon + éclair Inazuma + rose). Brodage 7 couleurs, dos sécurité, finition propre.",
		priceCents: 390,
		category: "badge",
		image: "/mark.webp",
		tags: ["badge", "brodé", "logo"],
		stockHint: "in-stock",
		highlights: [
			"Diamètre 56 mm",
			"Brodage 7 couleurs",
			"Dos sécurité plastique",
		],
	},
	{
		slug: "tshirt-rose-griffon-edition",
		name: "T-shirt · Rose Griffon Édition Limitée",
		tagline: "100% coton bio, sérigraphie 3 couleurs",
		description:
			"T-shirt édition limitée Rose Griffon, sérigraphie 3 couleurs avec le logo griffon central et le marquage Inazuma Eleven France au dos. Coton biologique 180g/m².",
		priceCents: 2490,
		category: "textile",
		image: "/mark.webp",
		variants: [
			{ id: "s", label: "Taille S" },
			{ id: "m", label: "Taille M" },
			{ id: "l", label: "Taille L" },
			{ id: "xl", label: "Taille XL" },
			{ id: "xxl", label: "Taille XXL" },
		],
		tags: ["textile", "édition limitée"],
		stockHint: "limited",
		highlights: [
			"100% coton biologique 180g/m²",
			"Sérigraphie 3 couleurs",
			"Coupe unisexe",
			"Édition limitée 200 exemplaires",
		],
	},
	{
		slug: "affiche-a2-achillea-rose-griffon",
		name: "Affiche A2 · Achillea × Rose Griffon",
		tagline: "Murale collector — édition compétition e-sport",
		description:
			"Affiche A2 célébrant la rencontre des deux pôles Rose Griffon (la maison mère) et Achillea (l'e-sport Inazuma Eleven). Illustration originale, papier 200g semi-mat.",
		priceCents: 1990,
		category: "affiche",
		image: "/mural1.webp",
		gallery: ["/mural1.webp", "/mural2.webp"],
		tags: ["affiche", "Achillea", "édition limitée"],
		stockHint: "low-stock",
		highlights: [
			"Format A2 (420 × 594 mm)",
			"Papier 200g semi-mat",
			"Édition tirage 100 ex",
		],
	},
	{
		slug: "carte-trading-roy-foil",
		name: "Carte Trading · Roy Fonteneau (Foil)",
		tagline: "Édition foil holographique limitée",
		description:
			"Reproduction officielle de la carte trading Roy Fonteneau en version foil holographique. Format carte à jouer 63×88mm, vernis sélectif sur la diagonale jaune.",
		priceCents: 490,
		category: "carte",
		image: "/RG_roy_LC.webp",
		tags: ["carte", "foil", "édition limitée", "Roy"],
		stockHint: "limited",
		highlights: [
			"Format 63 × 88 mm",
			"Foil holographique",
			"Vernis sélectif",
			"Sleeve incluse",
		],
	},
	{
		slug: "emote-pack-discord-twitch",
		name: "Pack Emotes Discord/Twitch",
		tagline: "5 emotes custom Rose Griffon (téléchargement digital)",
		description:
			"Pack digital de 5 emotes au format PNG transparent 112×112, 56×56 et 28×28, prêts à uploader sur votre serveur Discord ou chaîne Twitch. Lien de téléchargement envoyé après paiement.",
		priceCents: 590,
		category: "digital",
		image: "/emote.webp",
		tags: ["digital", "emote", "Discord", "Twitch"],
		stockHint: "in-stock",
		highlights: [
			"5 emotes au format PNG transparent",
			"3 tailles (112/56/28 px)",
			"Téléchargement immédiat",
			"Licence usage personnel + serveur Discord",
		],
	},
	{
		slug: "sticker-azalee-wiki-founder",
		name: "Sticker · Azalée Wiki Founder",
		tagline: "Édition collector — wiki azalee.rosegriffon.fr",
		description:
			"Sticker collector édité pour les contributeurs du wiki Azalée. Logo Azalée dégradé rose-orange officiel, format 80mm.",
		priceCents: 290,
		category: "sticker",
		image: "/RG_Azalee-logo.webp",
		tags: ["sticker", "Azalée", "édition limitée"],
		stockHint: "limited",
		highlights: [
			"Vinyle découpé 80 mm",
			"Dégradé rose → orange officiel",
			"Édition contributeurs wiki",
		],
	},
] as const;

export function getProduct(slug: string): Product | undefined {
	return PRODUCTS.find((p) => p.slug === slug);
}

export function getVariantPrice(product: Product, variantId?: string): number {
	if (!variantId || !product.variants) return product.priceCents;
	const v = product.variants.find((v) => v.id === variantId);
	return v?.priceCentsOverride ?? product.priceCents;
}

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
	"pack-patreon": "Packs Patreon",
	print: "Prints",
	sticker: "Stickers",
	"marque-page": "Marque-pages",
	badge: "Badges",
	textile: "Textile",
	affiche: "Affiches",
	carte: "Cartes",
	digital: "Digital",
};

export function formatEuros(cents: number): string {
	return new Intl.NumberFormat("fr-FR", {
		style: "currency",
		currency: "EUR",
		minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
	}).format(cents / 100);
}
