import { computed, signal } from "@angular/core";
import { ClanInviteDTO } from "../models/Clan";
import { firstValueFrom } from "rxjs";
import transliterate from "@sindresorhus/transliterate";

// Mapping clé FR (DB) → slug fichier image dans public/ranks/.
// 11 paliers Achillea (Fer → Légendaire, Rubis inclus) ; slugs ASCII (sans
// accents ni espaces) pointant vers les images Achillea (plus de Valorant).
const RANK_IMAGE_SLUG: Record<string, string> = {
	"non classé": "fer",
	"non classe": "fer",
	fer: "fer",
	bronze: "bronze",
	argent: "argent",
	or: "or",
	platine: "platine",
	diamant: "diamant",
	émeraude: "emeraude",
	emeraude: "emeraude",
	rubis: "rubis",
	divin: "divin",
	supernova: "supernova",
	légendaire: "legendaire",
	legendaire: "legendaire",
};

export function getEloImagePath(key: string | null | undefined) {
	if (!key) return `ranks/fer.webp`;
	const normalized = key.toLowerCase().normalize("NFKC");
	const slug = RANK_IMAGE_SLUG[normalized] ?? "fer";
	return `ranks/${slug}.webp`;
}

export function sqlDateToUsableDate(dateStr: string) {
	return new Date(dateStr);
}

export function normalizeNames(shortName: string) {
	shortName = shortName.normalize("NFKC");

	// Uppercase styled alphabets
	const alphaBlocks = [
		[0x1d504, 26], // Mathematical Fraktur Capitals
		[0x1d538, 26], // Mathematical Double-Struck Capitals
		[0x1d49c, 26], // Mathematical Script Capitals
		[0x1d4d0, 26], // Mathematical Bold Script Capitals
		[0x1d56c, 26], // Mathematical Bold Fraktur Capitals
		[0x1d5a0, 26], // Mathematical Sans-Serif Capitals
		[0x1d5d4, 26], // Mathematical Sans-Serif Bold Capitals
		[0x1d608, 26], // Mathematical Sans-Serif Italic Capitals
		[0x1d63c, 26], // Mathematical Sans-Serif Bold Italic Capitals
		[0x1d670, 26], // Mathematical Monospace Capitals
		[0x24b6, 26], // Enclosed Alphanumerics (circled capitals)
	];

	// Styled digits
	const digitBlocks = [
		[0x1d7ce, 10], // Mathematical Bold Digits
		[0x1d7d8, 10], // Mathematical Double-Struck Digits
		[0x1d7e2, 10], // Mathematical Sans-Serif Digits
		[0x1d7ec, 10], // Mathematical Sans-Serif Bold Digits
		[0x1d7f6, 10], // Mathematical Monospace Digits
	];

	const A = "A".charCodeAt(0);
	const Z = "Z".charCodeAt(0);
	const a = "a".charCodeAt(0);
	const z = "z".charCodeAt(0);
	const zero = "0".charCodeAt(0);
	const nine = "9".charCodeAt(0);

	let normalized = "";

	for (const char of Array.from(shortName)) {
		const code = char.codePointAt(0);
		if (!code) return "";

		// ASCII fast-pass
		let mappedChar: string = "";

		if ((code >= A && code <= Z) || (code >= zero && code <= nine)) {
			mappedChar = char;
		} else if (code >= a && code <= z) {
			mappedChar = String.fromCharCode(code - 32);
		}

		// Check uppercase letters
		if (!mappedChar) {
			for (const [start, len] of alphaBlocks) {
				if (code >= start && code < start + len) {
					mappedChar = String.fromCharCode(A + (code - start));
					break;
				}
			}
		}

		// Check digits (only if not already mapped)
		if (!mappedChar) {
			for (const [start, len] of digitBlocks) {
				if (code >= start && code < start + len) {
					mappedChar = String.fromCharCode(zero + (code - start));
					break;
				}
			}
		}

		if (!mappedChar) {
			mappedChar = transliterate(char);
		}

		// If still no mapping, reject entire string
		if (mappedChar === "") return "";

		normalized += mappedChar;
	}

	return normalized;
}
