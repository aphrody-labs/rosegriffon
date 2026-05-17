import { EmbedBuilder } from "discord.js";

export const RG_BRAND_HEX = "#a14b3f" as const;
export const RG_COLOR = Number.parseInt(RG_BRAND_HEX.slice(1), 16);
export const RG_FOOTER = "rosegriffon.fr";
export const RG_BASE_URL = Bun.env.WEBSITE_URL ?? "https://rosegriffon.fr";

export function rgEmbed(): EmbedBuilder {
	return new EmbedBuilder().setColor(RG_COLOR).setFooter({ text: RG_FOOTER });
}

export function truncate(text: string | null | undefined, max = 200): string {
	if (!text) return "";
	return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function rgUrl(path: string): string {
	return `${RG_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function fmtDate(d: Date | string | null): string {
	if (!d) return "—";
	const date = typeof d === "string" ? new Date(d) : d;
	return date.toLocaleDateString("fr-FR", {
		day: "2-digit",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export const DAYS_FR = [
	"Dimanche",
	"Lundi",
	"Mardi",
	"Mercredi",
	"Jeudi",
	"Vendredi",
	"Samedi",
];
