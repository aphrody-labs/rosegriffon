/**
 * Parseur de fichiers .objbin (OBJB — arbre d'objets-menu IEVR).
 * Port TypeScript du ObjbParser.cs C# (IECODE.Core.Formats.Menu).
 *
 * Format identique au conteneur cfg.bin de Level-5 :
 *   - En-tête 16 octets (4 × int32 LE)
 *   - Zone d'entrées (records typés à clés hashées CRC-32)
 *   - Table de chaînes
 *   - Table de clés (CRC → nom)
 *   - Pied de page cfg.bin (01 74 32 62 …)
 *
 * Structure d'un objet :
 *   OBJ_BGN("name")
 *     SETUP_BGN("gmdMenuObj")
 *       SETUP_PARAM("SkeletonAnime", "path/to.g4pkm")
 *       SETUP_PARAM("Texture", "#/path/<LG>/file.g4tx")
 *     SETUP_END
 *     PROP_INFO_BGN("CMenuRenderComponent")
 *       PROP_PARAM("m_drawPriority", int)
 *       PROP_PARAM("m_drawType",     int)
 *       PROP_PARAM("m_cameraName",   hash)
 *     PROP_INFO_END
 *     …
 *   OBJ_END
 *
 * API Bun-native (FileSystem via Bun.file, pas de node:fs requis).
 */

import type {
	AnimationComponent,
	AttachLocatorComponent,
	CollisionComponent,
	CollisionEntry,
	DispMaxEntry,
	MeshVisibleComponent,
	MeshVisibleEntry,
	MenuComponent,
	MenuObject,
	PrimitiveComponent,
	RenderComponent,
	SoundCmdComponent,
	TextComponent,
	TextEntry,
	UnknownComponent,
} from "./model";

// ── CRC-32 des records connus ─────────────────────────────────────────────────
// Validés sur les vrais fichiers IEVR.
const CRC_OBJ_BGN        = 0xb1d0c26e | 0;
const CRC_SETUP_BGN      = 0xb14dcdb0 | 0;
const CRC_SETUP_PARAM    = 0x8bb13144 | 0;
const CRC_SETUP_END      = 0x85158962 | 0;
const CRC_PROP_INFO_BGN  = 0x689952a2 | 0;
const CRC_PROP_PARAM     = 0xbd064d3e | 0;
const CRC_PROP_INFO_END  = 0x5cc11670 | 0;
const CRC_PROP_PARAM_BGN = 0x6454d5a5 | 0;
const CRC_PROP_PARAM_END = 0x500c9177 | 0;
const CRC_OBJ_END        = 0x858886bc | 0;

// ── Erreur ───────────────────────────────────────────────────────────────────

export class ObjbParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ObjbParseError";
	}
}

// ── Vérification rapide ──────────────────────────────────────────────────────

/**
 * Vérifie si un buffer contient le pied de page cfg.bin (01 74 32 62) dans
 * les 32 derniers octets.
 */
export function isObjb(data: Uint8Array): boolean {
	if (data.length < 16) return false;
	const searchStart = Math.max(0, data.length - 32);
	for (let i = searchStart; i <= data.length - 4; i++) {
		if (data[i] === 0x01 && data[i + 1] === 0x74 && data[i + 2] === 0x32 && data[i + 3] === 0x62)
			return true;
	}
	return false;
}

// ── Point d'entrée ────────────────────────────────────────────────────────────

/**
 * Parse un fichier .objbin depuis un Uint8Array ou ArrayBuffer.
 * @throws {ObjbParseError} Si le format est invalide.
 */
export function parseObjb(data: Uint8Array | ArrayBuffer): MenuObject {
	const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
	return parseInternal(new DataView(buf.buffer, buf.byteOffset, buf.byteLength), buf);
}

/**
 * Parse un fichier .objbin depuis un chemin de fichier (Bun-native).
 * @throws {ObjbParseError} Si le fichier est invalide.
 */
export async function parseObjbFile(path: string): Promise<MenuObject> {
	const buf = await Bun.file(path).arrayBuffer();
	return parseObjb(buf);
}

// ── Parse interne ─────────────────────────────────────────────────────────────

function parseInternal(view: DataView, raw: Uint8Array): MenuObject {
	if (raw.length < 16) throw new ObjbParseError("Fichier trop petit pour être un .objbin valide.");
	if (!isObjb(raw)) throw new ObjbParseError("Pied de page cfg.bin absent — fichier .objbin invalide.");

	const entryCount     = view.getInt32(0, true);
	const strTableOffset = view.getInt32(4, true);
	const strTableLength = view.getInt32(8, true);

	if (strTableOffset < 0x10 || strTableOffset > raw.length)
		throw new ObjbParseError(`StringTableOffset invalide : 0x${strTableOffset.toString(16)}`);
	if (strTableLength < 0 || strTableOffset + strTableLength > raw.length)
		throw new ObjbParseError("StringTable dépasse la fin du fichier.");

	const strings  = parseStringTable(raw, strTableOffset, strTableLength);
	const ktOffset = (strTableOffset + strTableLength + 15) & ~15;
	const keyTable = parseKeyTable(view, raw, ktOffset);

	const entries = parseEntries(view, strTableOffset - 0x10, entryCount, strings, keyTable);
	return buildObject(entries);
}

// ── Table de chaînes ─────────────────────────────────────────────────────────

function parseStringTable(raw: Uint8Array, offset: number, length: number): Map<number, string> {
	const result = new Map<number, string>();
	const decoder = new TextDecoder("utf-8");
	let pos = 0;
	while (pos < length) {
		const start = pos;
		while (pos < length && raw[offset + pos] !== 0) pos++;
		if (pos > start)
			result.set(start, decoder.decode(raw.subarray(offset + start, offset + pos)));
		pos++;
	}
	return result;
}

// ── Table de clés ─────────────────────────────────────────────────────────────

function parseKeyTable(view: DataView, raw: Uint8Array, ktOffset: number): Map<number, string> {
	const result = new Map<number, string>();
	if (ktOffset + 16 > raw.length) return result;

	const keyCount        = view.getInt32(ktOffset + 4, true);
	const keyStringOffset = view.getInt32(ktOffset + 8, true);
	const entriesBase     = ktOffset + 0x10;
	const stringBase      = ktOffset + keyStringOffset;
	const decoder         = new TextDecoder("utf-8");

	for (let i = 0; i < keyCount; i++) {
		const pos    = entriesBase + i * 8;
		if (pos + 8 > raw.length) break;
		const crc    = view.getUint32(pos, true);
		const strOff = view.getInt32(pos + 4, true);
		let   strEnd = stringBase + strOff;
		while (strEnd < raw.length && raw[strEnd] !== 0) strEnd++;
		result.set(crc, decoder.decode(raw.subarray(stringBase + strOff, strEnd)));
	}
	return result;
}

// ── Entrées brutes ───────────────────────────────────────────────────────────

interface RawEntry {
	readonly crc: number;
	readonly name: string | undefined;
	readonly paramTypes: Uint8Array; // 0=String, 1=Int, 2=Float, 3=Unknown
	readonly strParams: (string | null)[];
	readonly intParams: Int32Array;
}

function parseEntries(
	view: DataView,
	bufLength: number,
	count: number,
	strings: Map<number, string>,
	keyTable: Map<number, string>,
): RawEntry[] {
	const result: RawEntry[] = [];
	let pos = 0x10; // zone d'entrées commence à 0x10

	for (let i = 0; i < count; i++) {
		if (pos + 5 > view.byteLength) throw new ObjbParseError(`Entrée ${i} dépasse le buffer.`);

		const crc        = view.getUint32(pos, true);
		const paramCount = view.getUint8(pos + 4);
		const typeBytes  = Math.ceil(paramCount / 4);
		pos += 5;

		// Types : 2 bits par param
		const paramTypes = new Uint8Array(paramCount);
		let   paramIndex = 0;
		for (let j = 0; j < typeBytes; j++) {
			const tb = view.getUint8(pos++);
			for (let k = 0; k < 4 && paramIndex < paramCount; k++, paramIndex++)
				paramTypes[paramIndex] = (tb >> (2 * k)) & 3;
		}

		// Aligne à 4 octets
		if (pos % 4 !== 0) pos = (pos + 3) & ~3;

		// Lit les valeurs
		const strParams: (string | null)[] = new Array<string | null>(paramCount).fill(null);
		const intParams = new Int32Array(paramCount);

		for (let j = 0; j < paramCount; j++) {
			if (pos + 4 > view.byteLength) throw new ObjbParseError(`Paramètre ${j} de l'entrée ${i} dépasse le buffer.`);
			const raw = view.getInt32(pos, true);
			pos += 4;

			if (paramTypes[j] === 0) {
				// String : raw = offset dans la table de chaînes
				strParams[j] = raw !== -1 ? (strings.get(raw) ?? null) : null;
			} else {
				intParams[j] = raw;
			}
		}

		result.push({ crc, name: keyTable.get(crc), paramTypes, strParams, intParams });
	}
	return result;
}

// ── Helper : extraction des valeurs numériques ────────────────────────────────

/** Renvoie les valeurs numériques (non-String) d'une entrée. */
function extractIntValues(e: RawEntry): number[] {
	const values: number[] = [];
	for (let j = 0; j < e.paramTypes.length; j++) {
		if (e.paramTypes[j] !== 0) values.push(e.intParams[j] ?? 0);
	}
	return values;
}

// ── Construction de l'objet ──────────────────────────────────────────────────

function buildObject(entries: RawEntry[]): MenuObject {
	let i = 0;
	if (i >= entries.length || entries[i]!.crc !== (CRC_OBJ_BGN >>> 0))
		throw new ObjbParseError("OBJ_BGN attendu en position 0.");

	const name = entries[i]!.strParams[0] ?? "";
	i++;

	let engineType = "";
	let g4pkmPath: string | null = null;
	let g4txPath: string | null = null;

	// SETUP_BGN … SETUP_END
	if (i < entries.length && entries[i]!.crc === (CRC_SETUP_BGN >>> 0)) {
		engineType = entries[i]!.strParams[0] ?? "";
		i++;

		while (i < entries.length && entries[i]!.crc === (CRC_SETUP_PARAM >>> 0)) {
			const e   = entries[i]!;
			const key = e.strParams[0];
			const val = e.strParams[1] ?? null;
			if (key === "SkeletonAnime") g4pkmPath = val;
			else if (key === "Texture")  g4txPath  = normalizeG4txPath(val);
			i++;
		}

		if (i < entries.length && entries[i]!.crc === (CRC_SETUP_END >>> 0)) i++;
	}

	// PROP_INFO_BGN … PROP_INFO_END (répété pour chaque composant)
	const components: MenuComponent[] = [];

	while (i < entries.length && entries[i]!.crc !== (CRC_OBJ_END >>> 0)) {
		if (entries[i]!.crc === (CRC_PROP_INFO_BGN >>> 0)) {
			const cur      = entries[i]!;
			const compType = cur.strParams[0] ?? "";
			const modeVals = extractIntValues(cur);
			const compMode = modeVals[0] ?? 0;
			i++;

			const rawProps: { key: string; values: number[] }[] = [];
			const nestedGroups: { key: string; values: number[] }[][] = [];

			while (i < entries.length && entries[i]!.crc !== (CRC_PROP_INFO_END >>> 0)) {
				const entry = entries[i]!;
				if (entry.crc === (CRC_PROP_PARAM >>> 0)) {
					const key = entry.strParams[0] ?? "";
					rawProps.push({ key, values: extractIntValues(entry) });
					i++;
				} else if (entry.crc === (CRC_PROP_PARAM_BGN >>> 0)) {
					i++;
					const group: { key: string; values: number[] }[] = [];
					while (i < entries.length && entries[i]!.crc !== (CRC_PROP_PARAM_END >>> 0)) {
						const inner = entries[i]!;
						if (inner.crc === (CRC_PROP_PARAM >>> 0)) {
							const key = inner.strParams[0] ?? "";
							group.push({ key, values: extractIntValues(inner) });
						}
						i++;
					}
					if (i < entries.length) i++; // saute PROP_PARAM_END
					nestedGroups.push(group);
				} else {
					i++;
				}
			}
			if (i < entries.length) i++; // saute PROP_INFO_END

			components.push(buildComponent(compType, compMode, rawProps, nestedGroups));
		} else {
			i++;
		}
	}

	return { name, engineType, g4pkmPath, g4txPath, components };
}

// ── Construction des composants ───────────────────────────────────────────────

type Prop = { key: string; values: number[] };

function buildComponent(
	typeName: string,
	mode: number,
	props: Prop[],
	nested: Prop[][],
): MenuComponent {
	switch (typeName) {
		case "CMenuRenderComponent":
			return buildRenderComponent(typeName, props);
		case "CMenuAnimation":
			return buildAnimationComponent(typeName, props);
		case "MenuTextSetting":
			return buildTextComponent(typeName, mode, props);
		case "CMenuCreatePrimitiveComponent":
			return buildPrimitiveComponent(typeName, props);
		case "CMenuAttachLocator":
			return buildAttachLocatorComponent(typeName, props);
		case "MenuCollisionSetting":
			return buildCollisionComponent(typeName, mode, props);
		case "CMenuSoundCmdProperty":
			return buildSoundCmdComponent(typeName, props);
		case "CSetupMeshVisible":
			return buildMeshVisibleComponent(typeName, props, nested);
		default:
			return buildUnknownComponent(typeName, props);
	}
}

function buildRenderComponent(typeName: string, props: Prop[]): RenderComponent {
	let drawPriority   = 0;
	let drawType       = 0;
	let cameraNameHash = 0;

	for (const { key, values } of props) {
		if (values.length === 0) continue;
		if (key === "m_drawPriority") drawPriority   = values[0] ?? 0;
		if (key === "m_drawType")     drawType        = values[0] ?? 0;
		if (key === "m_cameraName")   cameraNameHash  = (values[0] ?? 0) >>> 0;
	}

	return { kind: "render", typeName, drawPriority, drawType, cameraNameHash };
}

function buildAnimationComponent(typeName: string, props: Prop[]): AnimationComponent {
	let motOpenHash   = 0;
	let motCloseHash  = 0;
	let motSelectHash = 0;

	for (const { key, values } of props) {
		if (key === "m_nameMotOpen") {
			motOpenHash   = values[0] !== undefined ? values[0] >>> 0 : 0;
			motCloseHash  = values[1] !== undefined ? values[1] >>> 0 : 0;
			motSelectHash = values[2] !== undefined ? values[2] >>> 0 : 0;
		}
	}

	return { kind: "animation", typeName, motOpenHash, motCloseHash, motSelectHash };
}

function buildTextComponent(typeName: string, tableIndex: number, props: Prop[]): TextComponent {
	const entries: TextEntry[] = props.map(({ key, values }) => ({
		key,
		hashes: values.map((v) => v >>> 0),
	}));
	return { kind: "text", typeName, tableIndex, entries };
}

function buildPrimitiveComponent(typeName: string, props: Prop[]): PrimitiveComponent {
	const numberSettingHashes: number[] = [];
	const dispMaxValues: DispMaxEntry[] = [];

	for (const { key, values } of props) {
		if (key === "MenuNumberSettingName") {
			for (const v of values) numberSettingHashes.push(v >>> 0);
		} else if (key === "DispMaxValue" && values.length >= 2) {
			dispMaxValues.push({ primitiveHash: (values[0] ?? 0) >>> 0, maxValue: values[1] ?? 0 });
		}
	}

	return { kind: "primitive", typeName, numberSettingHashes, dispMaxValues };
}

function buildAttachLocatorComponent(typeName: string, props: Prop[]): AttachLocatorComponent {
	const nullLayerHashes: number[] = [];
	for (const { key, values } of props) {
		if (key === "NullLayerName") for (const v of values) nullLayerHashes.push(v >>> 0);
	}
	return { kind: "attachLocator", typeName, nullLayerHashes };
}

function buildCollisionComponent(typeName: string, mode: number, props: Prop[]): CollisionComponent {
	const entries: CollisionEntry[] = props.map(({ key, values }) => ({
		key,
		enabled: values[0] ?? 0,
		type:    values[1] ?? 0,
		extra:   values[2] ?? 0,
	}));
	return { kind: "collision", typeName, mode, entries };
}

function buildSoundCmdComponent(typeName: string, props: Prop[]): SoundCmdComponent {
	const entries = props.map(({ key, values }) => ({ command: key, param: values[0] ?? 0 }));
	return { kind: "soundCmd", typeName, entries };
}

function buildMeshVisibleComponent(
	typeName: string,
	_props: Prop[],
	nested: Prop[][],
): MeshVisibleComponent {
	const params: MeshVisibleEntry[] = nested.map((group) => {
		let meshNameCrc = 0;
		let isVisible   = false;
		for (const { key, values } of group) {
			if (key === "meshNameCrc" && values.length > 0) meshNameCrc = (values[0] ?? 0) >>> 0;
			if (key === "isVisible"   && values.length > 0) isVisible   = (values[0] ?? 0) !== 0;
		}
		return { meshNameCrc, isVisible };
	});
	return { kind: "meshVisible", typeName, params };
}

function buildUnknownComponent(typeName: string, props: Prop[]): UnknownComponent {
	const rawParams = props.map(({ key, values }) => ({ key, values }));
	return { kind: "unknown", typeName, rawParams };
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

/** Normalise le chemin de texture : remplace "#/" par "dx11/". */
function normalizeG4txPath(path: string | null): string | null {
	if (!path) return null;
	if (path.startsWith("#/")) return "dx11/" + path.slice(2);
	return path;
}
