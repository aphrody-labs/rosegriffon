import { NextResponse } from "next/server";

// Données 100% statiques (mascots, socials).
export const revalidate = 86400;

export async function GET() {
	const info = {
		name: "Rose Griffon",
		slogan: "La communauté française dans ce qu'elle a d'entier.",
		website: "https://www.rosegriffon.fr",
		contact: "rosegriffonfr@gmail.com",
		colors: {
			primary: "#a14b3f", // Rouge Roy
			secondary: "#2f6e9c", // Bleu Gaëlle
		},
		socials: {
			twitter: "https://twitter.com/RoseGriffonFR",
			discord: "https://discord.gg/rosegriffon", // À vérifier
			twitch: "https://twitch.tv/rose_griffontv",
			youtube: "https://youtube.com/@RoseGriffon",
		},
		mascots: {
			roy: {
				name: "Roy",
				color: "#a14b3f",
				description: "Mascotte masculine (cheveux rouges/bruns)",
			},
			gaelle: {
				name: "Gaëlle",
				color: "#2f6e9c",
				description: "Mascotte féminine (cheveux bleus)",
			},
		},
		structure: {
			rose_griffon: "Cœur / Communauté / Art",
			achillea: "E-Sport / Compétition",
			azalee: "Média / Actualités",
		},
	};

	return NextResponse.json({
		success: true,
		data: info,
	});
}
