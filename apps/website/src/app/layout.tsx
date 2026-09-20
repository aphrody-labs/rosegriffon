import "./globals.css";

import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";

import { lato, notoSans, poppins, roboto } from "@/lib/fonts";
import { Geist } from "next/font/google";

import { GoogleTagManager } from "@next/third-parties/google";
import { resolveLocale } from "@rosegriffon/i18n";
import { isLocaleId } from "@rosegriffon/preferences";
import { WEBSITE_BASES, domaineDeLaRoute, type Domaine } from "@rosegriffon/app-shell";
import { ADSENSE_CLIENT, AdSenseScript, THEMES, type ThemeType } from "@rosegriffon/ui";

import ClientLayout from "./client-layout";

/** Conteneur Google Tag Manager. Absent = aucune balise injectée. */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/**
 * Thème par défaut de CHAQUE domaine du réseau.
 *
 * POURQUOI PAS UN DÉFAUT UNIQUE
 * Le script anti-scintillement posait `roy` — un thème CLAIR — quelle que soit
 * la section. Or `client-layout.tsx` pose déjà, après hydratation, la classe du
 * domaine sur la zone de contenu (`theme-azalee-dark` sous `/wiki`,
 * `theme-achillea` sous `/achillea`). Le texte venait donc des jetons d'un thème
 * SOMBRE et le fond de page, lui, restait celui du thème clair de `<html>`.
 * Mesuré en production sur `/wiki/tools` pour un visiteur sans préférence :
 * titre `rgb(237,224,219)` (= `#ede0db`, l'`on-surface` d'Azalée sombre) sur
 * fond `rgb(249,245,238)` (= `#f9f4ee`, la `surface` de Roy), soit un contraste
 * de 1,19:1 — 21 éléments sous 4,5:1 relevés sur `/wiki`.
 *
 * Les valeurs sont des clés de `THEMES` : `satisfies` fait échouer le
 * type-check si un thème est renommé ou retiré du catalogue.
 */
const THEME_PAR_DOMAINE = {
	association: "roy",
	esport: "achillea",
	wiki: "azalee-dark",
} satisfies Record<Domaine, ThemeType>;

/** Domaine servi à la racine : c'est le repli quand aucun préfixe ne matche. */
const DOMAINE_RACINE: Domaine = "association";

/**
 * Table `[préfixe, domaine, thème]` injectée telle quelle dans le script.
 *
 * On n'y recopie PAS la règle de routage : chaque préfixe est soumis à
 * `domaineDeLaRoute`, qui reste l'unique autorité sur « à quel domaine
 * appartient cette route ». Seule la LISTE des préfixes vit ici, parce qu'un
 * script inline ne peut pas embarquer la fonction elle-même.
 *
 * `/news` y figure parce que `domaineDeLaRoute` le rattache explicitement au
 * wiki, alors qu'il ne porte pas le préfixe `WEBSITE_BASES.wiki`.
 */
const SECTIONS = [WEBSITE_BASES.esport, WEBSITE_BASES.wiki, "/news"]
	.filter((prefixe): prefixe is string => typeof prefixe === "string" && prefixe !== "")
	.map((prefixe) => {
		const domaine = domaineDeLaRoute(prefixe, WEBSITE_BASES);
		return [prefixe, domaine, THEME_PAR_DOMAINE[domaine]] as const;
	});

/**
 * Script anti-scintillement — posé avant toute peinture, dans le `<head>`.
 *
 * TROIS CHOSES QU'IL DOIT FAIRE, ET POURQUOI
 *
 * 1. Choisir le thème SELON LA SECTION (cf. `THEME_PAR_DOMAINE`). La liste des
 *    thèmes valides est dérivée du catalogue `THEMES` — elle l'était déjà, et
 *    elle ne doit jamais redevenir une liste recopiée : quand elle avait
 *    divergé, le thème Achilléa était refusé au chargement.
 *
 * 2. ÉCRIRE le thème retenu dans `rg-theme`. Sans cela, ce script ne sert à
 *    rien : `next-themes` injecte son PROPRE script dans le `<body>`, qui
 *    retire toutes les classes de thème de `<html>` et repose
 *    `localStorage['rg-theme'] || defaultTheme` — donc `roy`. Écrire la clé
 *    avant qu'il ne la lise est le seul moyen de faire converger le script, le
 *    rendu, et le sélecteur de thème sur la même valeur.
 *
 * 3. Mémoriser le choix de l'utilisateur PAR DOMAINE (`rg-theme:<domaine>`).
 *    Une seule clé pour les trois domaines faisait fuiter le thème d'une
 *    section à l'autre : après une visite du wiki, `/achillea/ranked`
 *    s'affichait en `azalee-dark` (fond brun) au lieu de la charte Achilléa.
 *    `next-themes` n'écrit que `rg-theme` et on ne peut pas le lui faire dire
 *    autrement ; on détecte donc son écriture en comparant `rg-theme` à
 *    `rg-theme-pose` (la dernière valeur que NOUS avons posée) et on rattache
 *    le changement au domaine du dernier chargement (`rg-theme-pose-domaine`).
 *    Limite assumée : un changement de thème effectué après une navigation
 *    CÔTÉ CLIENT d'un domaine à l'autre est rattaché au domaine du dernier
 *    chargement complet. Le pire cas est un thème à re-choisir une fois, jamais
 *    un texte illisible — la lisibilité est garantie par les jetons, pas ici.
 *
 * Les trois `try` sont séparés : un `localStorage` indisponible (navigation
 * privée, cookies bloqués) ne doit pas empêcher la pose de la classe de
 * section, qui est justement ce qui rend la page lisible.
 */
const SCRIPT_THEME = `(function(){var C='rg-theme',P=C+'-pose',D=C+'-pose-domaine';var T=${JSON.stringify(
	Object.keys(THEMES)
)},S=${JSON.stringify(SECTIONS)},t=${JSON.stringify(
	THEME_PAR_DOMAINE[DOMAINE_RACINE]
)},d=${JSON.stringify(
	DOMAINE_RACINE
)};try{var c=location.pathname;for(var i=0;i<S.length;i++){var p=S[i][0];if(c===p||c.indexOf(p+'/')===0){d=S[i][1];t=S[i][2];break;}}}catch(e){}try{var a=localStorage.getItem(C),v=localStorage.getItem(P),w=localStorage.getItem(D);if(a&&T.indexOf(a)!==-1&&a!==v&&w)localStorage.setItem(C+':'+w,a);var s=localStorage.getItem(C+':'+d);if(s&&T.indexOf(s)!==-1)t=s;localStorage.setItem(C,t);localStorage.setItem(P,t);localStorage.setItem(D,d);}catch(e){}try{document.documentElement.classList.add(t);}catch(e){}})();`;

const geistSans = Geist({
	display: "swap",
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export const viewport: Viewport = {
	initialScale: 1,
	themeColor: "#a14b3f",
	viewportFit: "cover",
	width: "device-width",
	// MaximumScale et userScalable supprimés pour accessibilité WCAG
};

export const metadata: Metadata = {
	alternates: {
		// PAS de `canonical` ici. Les métadonnées Next sont héritées : un canonical
		// posé sur le layout racine s'applique à toute page qui n'en déclare pas un,
		// et /projets, /evenements, /notre-equipe, /legal/*, /shop, /shop/<produit>
		// et les chroniques annonçaient donc toutes « la page canonique, c'est
		// l'accueil » — soit l'instruction explicite de ne pas les indexer. L'accueil
		// pose le sien dans `app/page.tsx` ; chaque page publique pose le sien.
		types: {},
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Rose Griffon",
	},
	authors: [{ name: "Rose Griffon" }],
	creator: "Association Rose Griffon",
	description:
		"Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France. Découvrez nos événements, projets et rejoignez-nous !",
	formatDetection: {
		telephone: false,
	},
	icons: {
		apple: "/RG_Logo_V2.5.webp",
		icon: "/RG_Logo_V2.5.webp",
		shortcut: "/RG_Logo_V2.5.webp",
	},
	keywords:
		"Rose Griffon, Inazuma Eleven, association, communauté, gaming, France, Azalée, Achilléa, Roy, Gaëlle, Inazuma Eleven France, Inazuma Eleven France Association, Inazuma Eleven France Association Rose Griffon",
	metadataBase: new URL("https://rosegriffon.fr"),
	// Balise de propriété AdSense. C'est ce que la vérification du tableau de bord
	// cherche dans le HTML servi ; le script seul ne suffit pas à valider le site.
	other: {
		"google-adsense-account": ADSENSE_CLIENT,
	},
	openGraph: {
		description:
			"Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France. Découvrez nos événements, projets et rejoignez-nous !",
		locale: "fr_FR",
		siteName: "Rose Griffon",
		title: "Rose Griffon | Association Inazuma Eleven France",
		type: "website",
		url: "https://rosegriffon.fr",
	},
	publisher: "Association Rose Griffon",
	robots: {
		follow: true,
		googleBot: {
			follow: true,
			index: true,
			"max-image-preview": "large",
			"max-snippet": -1,
		},
		index: true,
	},
	title: "Rose Griffon | Association Inazuma Eleven France",
	twitter: {
		card: "summary_large_image",
		creator: "@rose_griffon",
		description:
			"Site officiel de l'association Rose Griffon, rassemblant la communauté Inazuma Eleven en France",
		title: "Rose Griffon | Association Inazuma Eleven France",
	},
};

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
	const locale = resolveLocale({
		acceptLanguage: headerStore.get("accept-language"),
		cookieLocale: cookieStore.get("rg-locale")?.value,
	});
	const initialLanguage = isLocaleId(locale.locale) ? locale.locale : "fr";

	return (
		<html lang={initialLanguage} dir={locale.direction} suppressHydrationWarning>
			<head>
				{/*
				 * Pré-application du thème avant hydratation (évite le FOUC) ;
				 * `next-themes` prend le relais une fois monté. Voir `SCRIPT_THEME`
				 * ci-dessus pour le détail des trois responsabilités et des mesures
				 * de contraste qui les motivent.
				 *
				 * Il reste EN PREMIER dans le `<head>` : il doit s'exécuter avant le
				 * script que `next-themes` injecte dans le `<body>`, sinon c'est ce
				 * dernier qui gagne et repeint tout en `roy`.
				 */}
				<script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
				<link rel="preconnect" href="https://cdn.discordapp.com" />
				<link rel="dns-prefetch" href="https://cdn.discordapp.com" />
				<link rel="preconnect" href="https://pagead2.googlesyndication.com" />
				<link rel="author" href="/humans.txt" />
				{/* Données structurées site-wide : Organization + WebSite (rich results Google). */}
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@graph": [
								{
									"@type": "Person",
									"@id": "https://rosegriffon.fr/#yoyo",
									name: "yoyo",
									alternateName: "yoyo",
									jobTitle: "Développeur & fondateur",
									url: "https://x.com/yoyo__goat",
									sameAs: ["https://x.com/yoyo__goat"],
									worksFor: { "@id": "https://rosegriffon.fr/#organization" },
								},
								{
									"@type": "Organization",
									"@id": "https://rosegriffon.fr/#organization",
									name: "Rose Griffon",
									alternateName: "Association Rose Griffon",
									url: "https://rosegriffon.fr",
									logo: "https://rosegriffon.fr/RG_Logo_V2.5.webp",
									description: "Association rassemblant la communauté Inazuma Eleven en France.",
									founder: { "@id": "https://rosegriffon.fr/#yoyo" },
									// Réseau Rose Griffon : 3 domaines siblings + tous les réseaux sociaux
									// (X/YouTube/Twitch/Instagram/Discord). sameAs partagé à l'identique
									// sur website / azalee / achillea pour une entité Organization cohérente.
									sameAs: [
										"https://rosegriffon.fr",
										"https://azalee.rosegriffon.fr",
										"https://achillea.rosegriffon.fr",
										"https://x.com/rose_griffon",
										"https://x.com/Azalee_IE",
										"https://x.com/Achillea_IE",
										"https://www.youtube.com/@RoseGriffon",
										"https://twitch.tv/rose_griffontv",
										"https://www.instagram.com/rose_griffonfr",
										"https://www.instagram.com/azaleefr",
										"https://discord.gg/TYzQvbByv4",
										"https://disboard.org/server/1072991720268111892",
										"https://discord.do/fr/inazuma-eleven-fr-%E2%9A%BD-rose-griffon/",
									],
									subOrganization: [
										{ "@id": "https://azalee.rosegriffon.fr/#website" },
										{ "@id": "https://achillea.rosegriffon.fr/#website" },
									],
								},
								{
									"@type": "WebSite",
									"@id": "https://rosegriffon.fr/#website",
									url: "https://rosegriffon.fr",
									name: "Rose Griffon",
									inLanguage: "fr-FR",
									publisher: { "@id": "https://rosegriffon.fr/#organization" },
									creator: { "@id": "https://rosegriffon.fr/#yoyo" },
								},
							],
						}),
					}}
				/>
				<script
					type="speculationrules"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							prefetch: [
								{
									where: {
										and: [
											{ href_matches: "/*" },
											{ not: { href_matches: "/admin/*" } },
											{ not: { href_matches: "/api/*" } },
											{ not: { selector_matches: "[rel~=nofollow]" } },
										],
									},
									eagerness: "moderate",
								},
							],
						}),
					}}
				/>
			</head>
			<body
				className={`${geistSans.variable} ${roboto.className} ${roboto.variable} ${poppins.variable} ${notoSans.variable} ${lato.variable}`}
				suppressHydrationWarning
			>
				{/* Google Tag Manager — composant officiel de `@next/third-parties`.
			    Il injecte le script du conteneur ET l'`<iframe>` de repli `noscript`,
			    en respectant la stratégie de chargement de Next : pas de balise collée
			    à la main dans le `<head>`, qui bloquerait le rendu.
			    L'identifiant vient de l'environnement : sans lui, rien n'est chargé,
			    ce qui laisse les environnements de développement propres. */}
				{GTM_ID && <GoogleTagManager gtmId={GTM_ID} />}
				{/* Google AdSense — chargeur unique du site. Les annonces automatiques
				    sont pilotées depuis le tableau de bord, donc aucune page n'a
				    d'emplacement à déclarer. La CSP de rosegriffon.fr est posée par
				    nginx (`infra/nginx/rg-csp-website.inc`) : y ajouter les hôtes
				    publicitaires avant toute bascule en mode bloquant. */}
				<AdSenseScript />
				<ClientLayout initialLanguage={initialLanguage}>{children}</ClientLayout>
			</body>
		</html>
	);
}
