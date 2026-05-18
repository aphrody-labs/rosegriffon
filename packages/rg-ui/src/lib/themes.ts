/**
 * Palette Rose Griffon - Référence officielle
 */
export const THEMES = {
	roy: {
		name: "Roy",
		icon: "/emote/RG_Roy_salut.webp",
		colors: {
			primary: "#344E8C", // Bleu Roy
			secondary: "#243D5B", // Bleu foncé
			accent: "#FFC46E", // Doré
			background: "#F2F6F7", // Blanc
			text: "#373434", // Noir
		},
	},
	gaelle: {
		name: "Gaëlle",
		icon: "/emote/RG_Gaelle_salut.webp",
		colors: {
			primary: "#B03519", // Vermillon
			secondary: "#770007", // Rouge
			accent: "#FFC46E", // Doré
			background: "#F2F6F7", // Blanc
			text: "#373434", // Noir
		},
	},
	"azalee-light": {
		name: "Azalée Light",
		icon: "/emote/RG_Azalee_salut.webp",
		colors: {
			primary: "#F2A93B",
			secondary: "#A92335",
			accent: "#FFE08B",
			background: "#FFF8F5",
			text: "#221A15",
		},
	},
	"azalee-dark": {
		name: "Azalée Dark",
		icon: "/emote/RG_Azalee_salut.webp",
		colors: {
			primary: "#FFC66C",
			secondary: "#FFB2BE",
			accent: "#FFDEA6",
			background: "#1A120D",
			text: "#EDE0DB",
		},
	},
} as const;

export type ThemeType = keyof typeof THEMES;
