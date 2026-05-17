export function normalizeText(text: string | null | undefined): string {
	if (!text) return "";
	return text
		.normalize("NFD")
		.replaceAll(/[\u0300-\u036f]/g, "") // Remove accents
		.toLowerCase();
}
