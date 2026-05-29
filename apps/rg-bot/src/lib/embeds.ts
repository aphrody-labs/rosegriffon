import { EmbedBuilder } from "discord.js";
import { RG_BRAND_HEX, RG_COLOR, RG_FOOTER, RG_BASE_URL } from "./config";

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
