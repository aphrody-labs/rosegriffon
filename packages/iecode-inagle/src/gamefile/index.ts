/**
 * Types de fichiers LEVEL-5 / CRI (IEVR) — **union discriminée `GameFile`** par magic + extension.
 *
 * Port TypeScript de `IECODE.Core.Formats.GameFileType` (C#) — la table des magics, la détection
 * par magic bytes / footer T2B / extension, et l'union discriminée émise par `EmitDts()`.
 *
 * Référence : `re/research/ghidra-export/REPORT.md` §6 « Magic strings » + `re/engine/asset-pipeline.md`.
 *
 * Discriminant = `kind` (string littérale, ex. `"texture"`, `"config"`, `"audio-hca"`). Chaque variante
 * porte `magic`, `extension`, `description`. Bun-native (DataView/Bun.file).
 */

// ── Métadonnées par type ───────────────────────────────────────────────────────

/** Discriminant littéral d'un type de fichier (clé de l'union `GameFile`). */
export type GameFileKind =
	| "archive"
	| "texture"
	| "package"
	| "package-menu"
	| "skeleton"
	| "model"
	| "model-group"
	| "material"
	| "motion"
	| "resource-archive"
	| "agi"
	| "config"
	| "objbin"
	| "pxcl"
	| "lua"
	| "utf"
	| "compressed"
	| "audio-archive"
	| "audio-bundle"
	| "audio-awb"
	| "audio-hca"
	| "audio-adx"
	| "video"
	| "xfsa"
	| "xpck"
	| "unknown";

/** Métadonnées immuables d'un type de fichier connu. */
export interface GameFileTypeInfo {
	readonly kind: GameFileKind;
	/** Magic affiché (ex. `"G4PK@"`, `"T2B/RDBN"`, `"\\x1bLua"`). */
	readonly magic: string;
	/** Extension canonique (ex. `".g4tx"`, `".cfg.bin"`). */
	readonly extension: string;
	readonly description: string;
}

/**
 * Variante d'un fichier détecté — c'est l'union discriminée `GameFile`.
 * Le narrowing par `file.kind` donne `magic`/`extension`/`description` littéraux.
 */
export type GameFile = GameFileTypeInfo;

// ── Table des types connus (autorité = GameFileType.cs KnownTypes) ─────────────

/** Tous les types connus, dans l'ordre du `.d.ts` C#. `as const` → littéraux exacts. */
export const KNOWN_GAME_FILE_TYPES = [
	{ kind: "archive", magic: "CPK ", extension: ".cpk", description: "Archive CRI" },
	{ kind: "texture", magic: "G4TX", extension: ".g4tx", description: "Texture LEVEL-5" },
	{ kind: "package", magic: "G4PK@", extension: ".g4pk", description: "Paquet LEVEL-5 (layout/motions)" },
	{ kind: "package-menu", magic: "G4PKM", extension: ".g4pkm", description: "Paquet menu LEVEL-5" },
	{ kind: "skeleton", magic: "G4SK@", extension: ".g4sk", description: "Squelette LEVEL-5" },
	{ kind: "model", magic: "G4MDP", extension: ".g4md", description: "Métadonnées modèle LEVEL-5" },
	{ kind: "model-group", magic: "G4MG", extension: ".g4mg", description: "Groupe de modèles LEVEL-5" },
	{ kind: "material", magic: "G4MT", extension: ".g4mt", description: "Matériau LEVEL-5" },
	{ kind: "motion", magic: "G4MA", extension: ".g4ma", description: "Animation LEVEL-5" },
	{ kind: "resource-archive", magic: "G4RA`", extension: ".g4ra", description: "Archive ressources LEVEL-5" },
	{ kind: "agi", magic: ".AGI", extension: ".agi", description: "Infos animation/graphiques LEVEL-5" },
	{ kind: "config", magic: "T2B/RDBN", extension: ".cfg.bin", description: "Configuration binaire LEVEL-5" },
	{ kind: "objbin", magic: "objb", extension: ".objbin", description: "Objets binaires LEVEL-5" },
	{ kind: "pxcl", magic: "PXCL", extension: ".pxcl", description: "Données pixel/collision LEVEL-5" },
	{ kind: "xfsa", magic: "XFSA", extension: ".xfsa", description: "Archive XFSA LEVEL-5" },
	{ kind: "xpck", magic: "XPCK", extension: ".xpck", description: "Paquet XPCK LEVEL-5" },
	{ kind: "lua", magic: "\\x1bLua", extension: ".lua.bin", description: "Bytecode Lua 5.2" },
	{ kind: "utf", magic: "@UTF", extension: ".utf", description: "Table UTF CRI" },
	{ kind: "compressed", magic: "CRILAYLA", extension: ".cri", description: "Compressé CRI LZSS" },
	{ kind: "audio-archive", magic: "AFS2", extension: ".afs2", description: "Archive audio CRI" },
	{ kind: "audio-bundle", magic: "@UTF", extension: ".acb", description: "Bundle audio CRI ACB (.acb only)" },
	{ kind: "audio-awb", magic: "AFS2", extension: ".awb", description: "Wave Bank audio CRI" },
	{ kind: "audio-hca", magic: "HCA\\0", extension: ".hca", description: "Audio HCA CRI" },
	{ kind: "audio-adx", magic: "\\x80\\0", extension: ".adx", description: "Audio ADX CRI" },
	{ kind: "video", magic: "CRID", extension: ".usm", description: "Vidéo USM CRI" },
] as const satisfies readonly GameFileTypeInfo[];

/** Map `kind → info` pour récupérer la variante complète depuis le discriminant. */
const BY_KIND = new Map<GameFileKind, GameFileTypeInfo>(
	KNOWN_GAME_FILE_TYPES.map((t) => [t.kind, t]),
);

/** Retourne la variante `GameFile` d'un `kind`, ou `undefined` si inconnu. */
export function gameFileInfo(kind: GameFileKind): GameFileTypeInfo | undefined {
	return BY_KIND.get(kind);
}

// ── Magics 32 bits LE (autorité = GameFileType.cs) ─────────────────────────────

const MAGIC_G4TX = 0x58543447; // "G4TX" LE
const MAGIC_G4PK = 0x4b503447; // "G4PK" LE (+ '@' ou 'M')
const MAGIC_G4SK = 0x4b533447; // "G4SK" LE (+ '@')
const MAGIC_G4MD = 0x444d3447; // "G4MD" LE (G4MDP)
const MAGIC_G4MG = 0x474d3447; // "G4MG" LE
const MAGIC_G4MT = 0x544d3447; // "G4MT" LE
const MAGIC_G4MA = 0x414d3447; // "G4MA" LE
const MAGIC_G4RA = 0x41523447; // "G4RA" LE (+ '`')
const MAGIC_RDBN = 0x4e424452; // "RDBN" LE
const MAGIC_CPK = 0x204b5043; // "CPK " LE
const MAGIC_AFS2 = 0x32534641; // "AFS2" LE
const MAGIC_UTF = 0x46545540; // "@UTF" LE
const MAGIC_CRIL = 0x4c495243; // "CRIL" LE (4 premiers octets de CRILAYLA)
const MAGIC_CRIL_HI = 0x414c5941; // "AYLA" LE (octets 4..8 de CRILAYLA)
const MAGIC_LUA = 0x61754c1b; // ESC + "Lua" LE
const MAGIC_OBJB = 0x626a626f; // "objb" LE
const MAGIC_PXCL = 0x4c435850; // "PXCL" LE
const MAGIC_XFSA = 0x41534658; // "XFSA" LE
const MAGIC_XPCK = 0x4b435058; // "XPCK" LE
const MAGIC_AGI = 0x4147492e; // ".AGI" — uint32 LE (FormatDetector.cs autorité ; octets disque 2e 49 47 41)
const MAGIC_HCA = 0x00414348; // "HCA\0" LE
const MAGIC_CRID = 0x44495243; // "CRID" LE (USM)

// T2B footer (4 derniers octets) : 01 74 32 62
const T2B_FOOTER = [0x01, 0x74, 0x32, 0x62] as const;

// ── Détection ───────────────────────────────────────────────────────────────

/**
 * Détecte le `GameFileKind` depuis les magic bytes (≥ 4 octets, 16 recommandés).
 * Retourne `"unknown"` si aucun magic reconnu (un cfg.bin T2B nécessite {@link detectGameFileFromData}).
 */
export function detectGameFile(magic: Uint8Array): GameFileKind {
	if (magic.length < 4) return "unknown";
	const view = new DataView(magic.buffer, magic.byteOffset, magic.byteLength);
	const m4 = view.getUint32(0, true);

	// G4PK@ vs G4PKM (5e octet discriminant).
	if (m4 === MAGIC_G4PK) {
		if (magic.length >= 5) return magic[4] === 0x4d ? "package-menu" : "package";
		return "package";
	}
	if (m4 === MAGIC_G4SK) return "skeleton";
	if (m4 === MAGIC_G4TX) return "texture";
	if (m4 === MAGIC_G4MD) return "model";
	if (m4 === MAGIC_G4MG) return "model-group";
	if (m4 === MAGIC_G4MT) return "material";
	if (m4 === MAGIC_G4MA) return "motion";
	if (m4 === MAGIC_G4RA) return "resource-archive";
	if (m4 === MAGIC_RDBN) return "config";

	if (m4 === MAGIC_CPK) return "archive";
	if (m4 === MAGIC_AFS2) return "audio-archive";
	if (m4 === MAGIC_UTF) return "utf"; // ACB inclus (@UTF) — voir .acb par extension
	if (m4 === MAGIC_HCA) return "audio-hca";
	if (m4 === MAGIC_CRID) return "video";

	if (m4 === MAGIC_CRIL && magic.length >= 8) {
		if (view.getUint32(4, true) === MAGIC_CRIL_HI) return "compressed";
	}

	if (m4 === MAGIC_LUA) return "lua";
	if (m4 === MAGIC_OBJB) return "objbin";
	if (m4 === MAGIC_PXCL) return "pxcl";
	if (m4 === MAGIC_XFSA) return "xfsa";
	if (m4 === MAGIC_XPCK) return "xpck";
	if (m4 === MAGIC_AGI) return "agi";

	return "unknown";
}

/** Vrai si le buffer se termine par le footer T2B `01 74 32 62`. */
function hasT2bFooter(data: Uint8Array): boolean {
	if (data.length < 4) return false;
	const n = data.length;
	return (
		data[n - 4] === T2B_FOOTER[0] &&
		data[n - 3] === T2B_FOOTER[1] &&
		data[n - 2] === T2B_FOOTER[2] &&
		data[n - 1] === T2B_FOOTER[3]
	);
}

/**
 * Détecte depuis un buffer complet — gère aussi le cfg.bin T2B (magic dans le footer).
 */
export function detectGameFileFromData(data: Uint8Array): GameFileKind {
	const kind = detectGameFile(data.length >= 16 ? data.subarray(0, 16) : data);
	if (kind !== "unknown") return kind;
	if (data.length >= 8 && hasT2bFooter(data)) return "config";
	return "unknown";
}

/**
 * Détecte depuis le chemin de fichier (lit le header + footer ; sinon l'extension).
 * Bun-native (`Bun.file`). Renvoie la variante `GameFile` complète, ou la variante `"unknown"`.
 */
export async function detectGameFilePath(path: string): Promise<GameFile> {
	const file = Bun.file(path);
	if (!(await file.exists())) return UNKNOWN;
	const buf = new Uint8Array(await file.arrayBuffer());

	let kind = detectGameFile(buf.length >= 16 ? buf.subarray(0, 16) : buf);
	if (kind === "unknown" && buf.length >= 8 && hasT2bFooter(buf)) kind = "config";
	if (kind === "unknown") kind = fromExtension(path);

	return gameFileInfo(kind) ?? UNKNOWN;
}

const UNKNOWN: GameFile = {
	kind: "unknown",
	magic: "",
	extension: "",
	description: "Format inconnu ou non détecté",
};

/** Détecte le type uniquement depuis l'extension du chemin (gère .lua.bin / .cfg.bin). */
export function fromExtension(path: string): GameFileKind {
	const name = (path.split(/[\\/]/u).at(-1) ?? path).toLowerCase();
	if (name.endsWith(".lua.bin")) return "lua";
	if (name.endsWith(".cfg.bin")) return "config";
	const dot = name.lastIndexOf(".");
	const ext = dot >= 0 ? name.slice(dot) : "";
	switch (ext) {
		case ".g4tx":
			return "texture";
		case ".g4sk":
			return "skeleton";
		case ".g4md":
			return "model";
		case ".g4mg":
			return "model-group";
		case ".g4mt":
			return "material";
		case ".g4ma":
			return "motion";
		case ".g4ra":
			return "resource-archive";
		case ".g4pkm":
			return "package-menu";
		case ".g4pk":
			return "package";
		case ".cpk":
			return "archive";
		case ".bin":
			return "config"; // heuristique
		case ".objbin":
			return "objbin";
		case ".pxcl":
			return "pxcl";
		case ".xfsa":
			return "xfsa";
		case ".xpck":
			return "xpck";
		case ".agi":
			return "agi";
		case ".afs2":
			return "audio-archive";
		case ".acb":
			return "audio-bundle";
		case ".awb":
			return "audio-awb";
		case ".hca":
			return "audio-hca";
		case ".adx":
			return "audio-adx";
		case ".usm":
			return "video";
		case ".utf":
			return "utf";
		default:
			return "unknown";
	}
}
