import { Component } from "@angular/core";
import { Card } from "primeng/card";
import { Divider } from "primeng/divider";
import { Tag } from "primeng/tag";

interface BrandFont {
	family: string; // valeur CSS font-family
	label: string; // nom affichable
	source: string; // source Drive
	fallback: string; // note fallback
}

interface BrandPalette {
	rank: number;
	name: string;
	primary: string; // 1er hex (token --color-achillea-rank-N)
	stopsVar: string; // nom CSS var listant les 5 stops
}

interface BrandLogo {
	label: string;
	path: string;
	note?: string;
}

@Component({
	selector: "app-brand",
	standalone: true,
	imports: [Card, Divider, Tag],
	templateUrl: "./brand.component.html",
	styleUrl: "./brand.component.css",
})
export class BrandComponent {
	protected readonly fonts: BrandFont[] = [
		{
			family: "Achillea Display",
			label: "Dirtyline 36DOT — Display",
			source: "typo/titre/Dirtyline-36Daysoftype-2022",
			fallback: "Inter",
		},
		{
			family: "Achillea Title",
			label: "HUMANE — Titre",
			source: "typo/titre/HUMANE",
			fallback: "Inter",
		},
		{
			family: "Achillea Title Alt",
			label: "Neue Metana Next — Titre alt.",
			source: "typo/titre/Neue-Metana-Next-Free-Font",
			fallback: "Inter",
		},
		{
			family: "Achillea Mono",
			label: "Liberation Mono — Intertitre",
			source: "typo/intertitre/liberation-mono",
			fallback: "ui-monospace",
		},
		{
			family: "Achillea Body",
			label: "MS Gothic — Corps",
			source: "typo/corps de texte/msgothic",
			fallback: "Inter",
		},
		{
			family: "Achillea Display Num",
			label: "Satoshi Black — Numéro Coupe d'Ilion",
			source: "typo/numéro coupe d'ilion/Satoshi-Black",
			fallback: "Inter",
		},
	];

	protected readonly palette: BrandPalette[] = [
		{ rank: 1, name: "Fer", primary: "#959595", stopsVar: "--achillea-rank-1-stops" },
		{ rank: 2, name: "Bronze", primary: "#B17253", stopsVar: "--achillea-rank-2-stops" },
		{ rank: 3, name: "Argent", primary: "#7FACB8", stopsVar: "--achillea-rank-3-stops" },
		{ rank: 4, name: "Or", primary: "#C2AD88", stopsVar: "--achillea-rank-4-stops" },
		{ rank: 5, name: "Platine", primary: "#897E8B", stopsVar: "--achillea-rank-5-stops" },
		{ rank: 6, name: "Diamant", primary: "#88F6FF", stopsVar: "--achillea-rank-6-stops" },
		{ rank: 7, name: "Émeraude", primary: "#2D925C", stopsVar: "--achillea-rank-7-stops" },
		{ rank: 8, name: "Rubis", primary: "#FF5648", stopsVar: "--achillea-rank-8-stops" },
		{ rank: 9, name: "Divin", primary: "#7EDCB5", stopsVar: "--achillea-rank-9-stops" },
		{ rank: 10, name: "Supernova", primary: "#F010FF", stopsVar: "--achillea-rank-10-stops" },
		{ rank: 11, name: "Légendaire", primary: "#FFA910", stopsVar: "--achillea-rank-11-stops" },
	];

	protected readonly logos: BrandLogo[] = [
		{ label: "Logo dark (assets)", path: "assets/logo_dark.png", note: "utilisé en mode dark" },
		{ label: "Logo light (assets)", path: "assets/logo_light.png", note: "utilisé en mode light" },
		{ label: "Logo SVG (public)", path: "logo.svg", note: "vectoriel, scalable" },
		{ label: "Pictogramme Achilléa", path: "achillea.png", note: "symbole carré" },
		{ label: "Bannière Achilléa", path: "achillea-banner.png", note: "header / opengraph" },
	];

	/** linear-gradient inline depuis les CSS vars stops d'un palier. */
	protected gradient(stopsVar: string): string {
		return `linear-gradient(135deg, var(${stopsVar}))`;
	}

	/** font-family CSS pour démo échantillon. */
	protected sampleFontStack(family: string, fallback: string): string {
		return `'${family}', ${fallback}, sans-serif`;
	}
}
