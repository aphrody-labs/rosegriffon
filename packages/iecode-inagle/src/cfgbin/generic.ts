/**
 * Décodeur générique cfg.bin — arbre typé unifié, T2B et RDBN.
 *
 * Port TypeScript de CfgBinGeneric.cs (IECODE.Core.Formats.Level5).
 *
 * Formats supportés :
 *   • T2B  — pied de page « 01 74 32 62 »  (records CRC-32 + variables typées)
 *   • RDBN — magic   « 52 44 42 4E »       (tables homotypées)
 *
 * API principale :
 *   decodeCfgBin(data, fileName?)  → CfgBinDocument
 *   decodeCfgBinFile(path)         → Promise<CfgBinDocument>
 *
 * Déchiffrement automatique via le nom de fichier (clé CRC-32 du nom),
 * même algorithme que CriwareCrypt.cs.
 *
 * Bun-native : Bun.file / DataView / TextDecoder.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Type sémantique d'une valeur dans un nœud cfg.bin. */
export type CfgBinValueKind =
	| "string"
	| "int"
	| "float"
	| "hash"   // hash CRC-32 affiché en hex "0xABCD1234"
	| "bool"
	| "short"
	| "byte"
	| "tuple"  // float[] ou short[]
	| "blob"   // hex string
	| "unknown";

/** Valeur typée dans un record cfg.bin. */
export interface CfgBinValue {
	readonly name:  string;
	readonly kind:  CfgBinValueKind;
	readonly value: string | number | boolean | number[] | null;
}

/** Record T2B (arborescent) ou ligne RDBN (plat). */
export interface CfgBinRecord {
	readonly name:     string;
	readonly fields:   CfgBinValue[];
	readonly children: CfgBinRecord[]; // toujours vide en RDBN
}

/** Table RDBN — liste de records homotypés. */
export interface CfgBinTable {
	readonly name:     string;
	readonly typeName: string;
	readonly rows:     CfgBinRecord[];
}

/** Document cfg.bin décodé. */
export interface CfgBinDocument {
	readonly format:   "T2B" | "RDBN";
	readonly encoding: string;
	/** Records racines T2B (vide pour RDBN). */
	readonly records:  CfgBinRecord[];
	/** Tables RDBN (vide pour T2B). */
	readonly tables:   CfgBinTable[];
}

// ── Erreur ────────────────────────────────────────────────────────────────────

export class CfgBinDecodeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "CfgBinDecodeError";
	}
}

// ── Points d'entrée ───────────────────────────────────────────────────────────

/**
 * Décode un fichier cfg.bin depuis un Uint8Array ou ArrayBuffer.
 *
 * @param data       Octets bruts (chiffrés ou non).
 * @param fileName   Nom du fichier — utilisé comme clé de déchiffrement si le
 *                   fichier est chiffré (ex. "cpk_list.cfg.bin"). Optionnel.
 * @param hashDict   Dictionnaire hash→nom optionnel pour la résolution RDBN.
 */
export function decodeCfgBin(
	data:     Uint8Array | ArrayBuffer,
	fileName?: string,
	hashDict?: ReadonlyMap<number, string>,
): CfgBinDocument {
	let buf = data instanceof Uint8Array ? data : new Uint8Array(data);

	// Déchiffrement optionnel
	if (fileName && !hasT2bFooter(buf) && !isRdbn(buf)) {
		buf = decryptCriware(buf, fileName);
	}

	if (isRdbn(buf))
		return decodeRdbn(new DataView(buf.buffer, buf.byteOffset, buf.byteLength), buf, hashDict);

	if (hasT2bFooter(buf))
		return decodeT2b(new DataView(buf.buffer, buf.byteOffset, buf.byteLength), buf);

	throw new CfgBinDecodeError(
		"Format cfg.bin non reconnu : ni T2B (footer 01 74 32 62) ni RDBN (magic RDBN).",
	);
}

/**
 * Décode un fichier cfg.bin depuis le système de fichiers (Bun-native).
 */
export async function decodeCfgBinFile(
	path:     string,
	hashDict?: ReadonlyMap<number, string>,
): Promise<CfgBinDocument> {
	const ab  = await Bun.file(path).arrayBuffer();
	const buf = new Uint8Array(ab);
	const fileName = path.split("/").at(-1) ?? path.split("\\").at(-1) ?? path;
	return decodeCfgBin(buf, fileName, hashDict);
}

// ── Détection du format ───────────────────────────────────────────────────────

const RDBN_MAGIC = 0x4e424452; // "RDBN" LE

/** Vérifie si le buffer est au format RDBN. */
export function isRdbn(buf: Uint8Array): boolean {
	if (buf.length < 4) return false;
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	return view.getUint32(0, true) === RDBN_MAGIC;
}

/** Vérifie si le buffer contient le pied de page T2B dans les 32 derniers octets. */
export function hasT2bFooter(buf: Uint8Array): boolean {
	if (buf.length < 16) return false;
	const searchStart = Math.max(0, buf.length - 32);
	for (let i = searchStart; i <= buf.length - 4; i++) {
		if (buf[i] === 0x01 && buf[i + 1] === 0x74 && buf[i + 2] === 0x32 && buf[i + 3] === 0x62)
			return true;
	}
	return false;
}

// ── Décodage T2B ──────────────────────────────────────────────────────────────

function decodeT2b(view: DataView, raw: Uint8Array): CfgBinDocument {
	if (raw.length < 16)
		throw new CfgBinDecodeError("Fichier T2B trop petit.");

	const entryCount     = view.getInt32(0, true);
	const strTableOffset = view.getInt32(4, true);
	const strTableLength = view.getInt32(8, true);

	if (strTableOffset < 0x10 || strTableOffset > raw.length)
		throw new CfgBinDecodeError(`StringTableOffset invalide : 0x${strTableOffset.toString(16)}`);
	if (strTableLength < 0 || strTableOffset + strTableLength > raw.length)
		throw new CfgBinDecodeError("StringTable dépasse la fin du fichier.");

	// Encodage détecté depuis l'octet à -10 (avant la fin)
	const encodingByte = raw[raw.length - 10] ?? 1;
	const encoding     = encodingByte === 0 ? "shift_jis" : "utf-8";

	const strings  = parseStringTable(raw, strTableOffset, strTableLength, encoding);
	const ktOffset = (strTableOffset + strTableLength + 15) & ~15;
	const keyTable = parseKeyTable(view, raw, ktOffset);

	const entries = parseT2bEntries(view, 0x10, strTableOffset - 0x10, entryCount, strings, keyTable);
	const records = buildT2bRecords(entries);

	return { format: "T2B", encoding, records, tables: [] };
}

// ── Table de chaînes (T2B) ────────────────────────────────────────────────────

function parseStringTable(
	raw:     Uint8Array,
	offset:  number,
	length:  number,
	charset: string,
): Map<number, string> {
	const result  = new Map<number, string>();
	// shift-jis est un label WHATWG valide au runtime Bun mais absent du type TextDecoder.
	const label   = (charset === "shift_jis" ? "shift-jis" : "utf-8") as ConstructorParameters<typeof TextDecoder>[0];
	const decoder = new TextDecoder(label);
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

// ── Table de clés (T2B + objbin) ──────────────────────────────────────────────

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

// ── Entrées brutes T2B ────────────────────────────────────────────────────────

interface RawT2bEntry {
	readonly crc:        number;
	readonly name:       string | undefined;
	readonly paramTypes: Uint8Array; // 0=String, 1=Int, 2=Float, 3=Unknown
	readonly strParams:  (string | null)[];
	readonly intParams:  Int32Array;
}

function parseT2bEntries(
	view:       DataView,
	bufStart:   number,
	bufLength:  number,
	count:      number,
	strings:    Map<number, string>,
	keyTable:   Map<number, string>,
): RawT2bEntry[] {
	const result: RawT2bEntry[] = [];
	// pos est relatif à bufStart (comme le reader C# dans ParseEntries)
	let relPos = 0;
	const bufEnd = bufLength;

	for (let i = 0; i < count; i++) {
		if (relPos + 5 > bufEnd) break;

		const pos0       = bufStart + relPos;
		const crc        = view.getUint32(pos0, true);
		const paramCount = view.getUint8(pos0 + 4);
		const typeBytes  = Math.ceil(paramCount / 4);
		relPos += 5;

		const paramTypes = new Uint8Array(paramCount);
		let   paramIndex = 0;
		for (let j = 0; j < typeBytes; j++) {
			const tb = view.getUint8(bufStart + relPos++);
			for (let k = 0; k < 4 && paramIndex < paramCount; k++, paramIndex++)
				paramTypes[paramIndex] = (tb >> (2 * k)) & 3;
		}

		// Aligne à 4 octets (identique à CfgBin.cs : position relative dans le buffer d'entrées)
		// Condition : (typeBytes + 1) % 4 !== 0 (calqué sur CfgBin.ParseEntries)
		if ((typeBytes + 1) % 4 !== 0) {
			const mod = relPos % 4;
			if (mod !== 0) relPos += (4 - mod);
		}

		const strParams: (string | null)[] = new Array<string | null>(paramCount).fill(null);
		const intParams = new Int32Array(paramCount);

		for (let j = 0; j < paramCount; j++) {
			if (bufStart + relPos + 4 > view.byteLength) break;
			const raw = view.getInt32(bufStart + relPos, true);
			relPos += 4;
			if (paramTypes[j] === 0) {
				strParams[j] = raw !== -1 ? (strings.get(raw) ?? null) : null;
			} else {
				intParams[j] = raw;
			}
		}

		result.push({ crc, name: keyTable.get(crc), paramTypes, strParams, intParams });
	}
	return result;
}

// ── Construction de l'arbre T2B ───────────────────────────────────────────────

function buildT2bRecords(entries: RawT2bEntry[]): CfgBinRecord[] {
	// Reconstruction de l'arbre à partir des noms de records.
	//
	// La clé de la table de clés est sans suffixe numérique (ex. "EV_CMND_INFO_DATA_LIST_BEG")
	// alors que le C# ajoute _0, _1… avant le traitement. On détecte sur le dernier
	// composant du nom après split('_'), qui peut être "BEG"/"BEGIN"/"START"/"END"/etc.
	const stack:  CfgBinRecord[] = [];
	const output: CfgBinRecord[] = [];

	for (const entry of entries) {
		const name   = entry.name ?? `UNKNOWN_${(entry.crc >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
		const fields = buildT2bFields(entry);

		// Dernier composant après split
		const parts   = name.split("_");
		const lastPart = (parts[parts.length - 1] ?? "").toUpperCase();
		const isBegin = lastPart === "BEG" || lastPart === "BEGIN" || lastPart === "START"
		             || (lastPart !== "PTREE" && name.toUpperCase().endsWith("PTREE"));
		const isEnd   = lastPart === "END" || lastPart === "PTREE" || name.toUpperCase().includes("_PTREE");

		if (isBegin) {
			const newNode: CfgBinRecord = { name, fields, children: [] };
			if (stack.length > 0) {
				(stack[stack.length - 1]!.children as CfgBinRecord[]).push(newNode);
			} else {
				output.push(newNode);
			}
			stack.push(newNode);
		} else if (isEnd) {
			if (stack.length > 0) stack.pop();
		} else {
			const leaf: CfgBinRecord = { name, fields, children: [] };
			if (stack.length > 0) {
				(stack[stack.length - 1]!.children as CfgBinRecord[]).push(leaf);
			} else {
				output.push(leaf);
			}
		}
	}

	return output;
}

function buildT2bFields(entry: RawT2bEntry): CfgBinValue[] {
	const fields: CfgBinValue[] = [];
	for (let i = 0; i < entry.paramTypes.length; i++) {
		const kind: CfgBinValueKind = entry.paramTypes[i] === 0 ? "string"
			: entry.paramTypes[i] === 2 ? "float"
			: entry.paramTypes[i] === 1 ? "int"
			: "unknown";

		let value: CfgBinValue["value"];
		if (entry.paramTypes[i] === 0) {
			value = entry.strParams[i] ?? null;
		} else if (entry.paramTypes[i] === 2) {
			// Float : réinterprète les bits Int32 comme Float32
			const tmp = new Int32Array(1);
			tmp[0] = entry.intParams[i] ?? 0;
			value = new Float32Array(tmp.buffer)[0] ?? 0;
		} else {
			value = entry.intParams[i] ?? 0;
		}

		fields.push({ name: `#${i}`, kind, value });
	}
	return fields;
}

// ── Décodage RDBN ─────────────────────────────────────────────────────────────

/*
 * Structure en-tête RDBN (cf. RdbnStructures.cs) :
 *   0x00 uint32 magic
 *   0x04 int16  headerSize
 *   0x06 int32  version
 *   0x0A int16  dataOffset  (× 4 → octets)
 *   0x0C int32  dataSize
 *   0x10 [0x14 octets de padding]
 *   0x24 int16  typeOffset   (× 4 depuis dataOffset)
 *   0x26 int16  typeCount
 *   0x28 int16  fieldOffset  (× 4 depuis dataOffset)
 *   0x2A int16  fieldCount
 *   0x2C int16  rootOffset   (× 4 depuis dataOffset)
 *   0x2E int16  rootCount
 *   0x30 int16  stringHashOffset (× 4 depuis dataOffset)
 *   0x32 int16  stringOffsetsOffset (× 4 depuis dataOffset)
 *   0x34 int16  hashCount
 *   0x36 int16  valueOffset  (× 4 depuis dataOffset)
 *   0x38 int32  stringOffset (depuis dataOffset, en octets)
 *
 * EntrySize = 0x20 (32 octets)
 */

const ENTRY_SIZE = 0x20;

function decodeRdbn(
	view:     DataView,
	raw:      Uint8Array,
	hashDict?: ReadonlyMap<number, string>,
): CfgBinDocument {
	if (raw.length < 0x50)
		throw new CfgBinDecodeError("Fichier RDBN trop petit.");

	const dataOffset   = view.getInt16(0x0a, true) * 4;
	const version      = view.getInt32(0x06, true);

	const typeOffset   = view.getInt16(0x24, true) * 4 + dataOffset;
	const typeCount    = view.getInt16(0x26, true);
	const fieldOffset  = view.getInt16(0x28, true) * 4 + dataOffset;
	const fieldCount   = view.getInt16(0x2a, true);
	const rootOffset   = view.getInt16(0x2c, true) * 4 + dataOffset;
	const rootCount    = view.getInt16(0x2e, true);

	const hashOff      = view.getInt16(0x30, true) * 4 + dataOffset;
	const offOff       = view.getInt16(0x32, true) * 4 + dataOffset;
	const hashCount    = view.getInt16(0x34, true);
	const valueOff     = view.getInt16(0x36, true) * 4 + dataOffset;
	const strBase      = view.getInt32(0x38, true) + dataOffset;

	const decoder = new TextDecoder("utf-8");

	// Table de chaînes RDBN (hashé → string)
	const rdbnStrings = new Map<number, string>();
	for (let i = 0; i < hashCount; i++) {
		const hash   = view.getUint32(hashOff + i * 4, true);
		const strOff = view.getInt32(offOff + i * 4, true);
		const strPos = strBase + strOff;
		let   end    = strPos;
		while (end < raw.length && raw[end] !== 0) end++;
		rdbnStrings.set(hash, decoder.decode(raw.subarray(strPos, end)));
	}

	// Types
	const typeEntries: { nameHash: number; fieldIndex: number; fieldCount: number }[] = [];
	for (let i = 0; i < typeCount; i++) {
		const pos = typeOffset + i * ENTRY_SIZE;
		typeEntries.push({
			nameHash:   view.getUint32(pos, true),
			fieldIndex: view.getInt16(pos + 8, true),
			fieldCount: view.getInt16(pos + 10, true),
		});
	}

	// Champs
	const fieldEntries: { nameHash: number; type: number; valueSize: number; valueOffset: number }[] = [];
	for (let i = 0; i < fieldCount; i++) {
		const pos = fieldOffset + i * ENTRY_SIZE;
		fieldEntries.push({
			nameHash:    view.getUint32(pos, true),
			type:        view.getInt16(pos + 4, true),
			valueSize:   view.getInt32(pos + 8, true),
			valueOffset: view.getInt32(pos + 12, true),
		});
	}

	// Racines (listes)
	const tables: CfgBinTable[] = [];
	for (let ri = 0; ri < rootCount; ri++) {
		const rpos        = rootOffset + ri * ENTRY_SIZE;
		const typeIndex   = view.getInt16(rpos, true);
		const rValueOff   = view.getInt32(rpos + 4, true);
		const rValueSize  = view.getInt32(rpos + 8, true);
		const rValueCount = view.getInt32(rpos + 12, true);
		const nameHash    = view.getUint32(rpos + 16, true);

		const listName = rdbnStrings.get(nameHash) ?? `Unknown_0x${nameHash.toString(16).toUpperCase().padStart(8, "0")}`;
		const typeInfo = typeEntries[typeIndex];
		if (!typeInfo) continue;
		const typeName = rdbnStrings.get(typeInfo.nameHash) ?? `Type_0x${typeInfo.nameHash.toString(16).toUpperCase().padStart(8, "0")}`;

		const rows: CfgBinRecord[] = [];
		const rootValBase = valueOff + rValueOff;

		for (let v = 0; v < rValueCount; v++) {
			const entryBase = rootValBase + v * rValueSize;
			const fields: CfgBinValue[] = [];

			for (let f = 0; f < typeInfo.fieldCount; f++) {
				const fieldInfo = fieldEntries[typeInfo.fieldIndex + f];
				if (!fieldInfo) continue;

				const fName = rdbnStrings.get(fieldInfo.nameHash)
					?? `Field_0x${fieldInfo.nameHash.toString(16).toUpperCase().padStart(8, "0")}`;
				const fOffset = entryBase + fieldInfo.valueOffset;
				const { kind, value } = readRdbnFieldValue(view, raw, fOffset, fieldInfo.type, fieldInfo.valueSize, strBase, rdbnStrings, hashDict);
				fields.push({ name: fName, kind, value });
			}

			rows.push({ name: typeName, fields, children: [] });
		}

		tables.push({ name: listName, typeName, rows });
	}

	return { format: "RDBN", encoding: "utf-8", records: [], tables };
}

// ── Lecture d'une valeur de champ RDBN ───────────────────────────────────────

// Types RDBN (cf. RdbnFieldType enum)
const RDBN_BOOL      = 3;
const RDBN_BYTE      = 4;
const RDBN_SHORT     = 5;
const RDBN_INT       = 6;
const RDBN_ACT_TYPE  = 9;
const RDBN_FLAG      = 10;
const RDBN_FLOAT     = 0x0d;
const RDBN_HASH      = 0x0f;
const RDBN_RATES     = 0x12;
const RDBN_POSITION  = 0x13;
const RDBN_CONDITION = 0x14;
const RDBN_SHORT_TUPLE = 0x15;

function readRdbnFieldValue(
	view:      DataView,
	raw:       Uint8Array,
	offset:    number,
	type:      number,
	valueSize: number,
	strBase:   number,
	strings:   Map<number, string>,
	hashDict?: ReadonlyMap<number, string>,
): { kind: CfgBinValueKind; value: CfgBinValue["value"] } {
	if (offset + valueSize > view.byteLength)
		return { kind: "unknown", value: null };

	switch (type) {
		case RDBN_BOOL:
			return { kind: "bool",  value: raw[offset] !== 0 };

		case RDBN_BYTE:
			return { kind: "byte",  value: raw[offset] ?? 0 };

		case RDBN_SHORT:
		case RDBN_ACT_TYPE:
			return { kind: "short", value: view.getInt16(offset, true) };

		case RDBN_INT:
		case RDBN_FLAG:
			return { kind: "int",   value: view.getInt32(offset, true) };

		case RDBN_FLOAT:
			return { kind: "float", value: view.getFloat32(offset, true) };

		case RDBN_HASH: {
			const h = view.getUint32(offset, true);
			// Résolution via hashDict externe ou strings RDBN
			const name = hashDict?.get(h) ?? strings.get(h);
			if (name !== undefined)
				return { kind: "string", value: name };
			return { kind: "hash", value: h };
		}

		case RDBN_RATES:
		case RDBN_POSITION: {
			// 4 × float32
			const arr: number[] = [
				view.getFloat32(offset,      true),
				view.getFloat32(offset + 4,  true),
				view.getFloat32(offset + 8,  true),
				view.getFloat32(offset + 12, true),
			];
			return { kind: "tuple", value: arr };
		}

		case RDBN_SHORT_TUPLE: {
			const arr: number[] = [
				view.getInt16(offset,     true),
				view.getInt16(offset + 2, true),
			];
			return { kind: "tuple", value: arr };
		}

		case RDBN_CONDITION: {
			// Valeur = offset dans la string table
			const strOff = view.getUint32(offset, true);
			const strPos = strBase + strOff;
			if (strPos > 0 && strPos < raw.length) {
				let end = strPos;
				while (end < raw.length && raw[end] !== 0) end++;
				const s = new TextDecoder("utf-8").decode(raw.subarray(strPos, end));
				return { kind: "string", value: s };
			}
			return { kind: "int", value: strOff };
		}

		default: {
			// Blob hex
			const len  = Math.min(valueSize, raw.length - offset);
			const blob = Array.from(raw.subarray(offset, offset + len))
				.map((b) => b.toString(16).toUpperCase().padStart(2, "0"))
				.join("");
			return { kind: "blob", value: blob };
		}
	}
}

// ── Déchiffrement CriwareCrypt ────────────────────────────────────────────────

// Table CRC-32 (identique à CriwareCrypt.cs)
const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table(): Uint32Array {
	const t = new Uint32Array(256);
	for (let i = 0; i < 256; i++) {
		let c = i >>> 0;
		for (let j = 0; j < 8; j++)
			c = (c & 1) !== 0 ? ((c >>> 1) ^ 0xedb88320) >>> 0 : (c >>> 1) >>> 0;
		t[i] = c;
	}
	return t;
}

/** Calcule la clé de déchiffrement CriwareCrypt depuis le nom du fichier. */
export function crcKeyFromFileName(name: string): number {
	const bytes = new TextEncoder().encode(name);
	let crc = 0xffffffff;
	for (const b of bytes)
		crc = ((crc >>> 8) ^ (CRC32_TABLE[((crc ^ b) & 0xff)]!)) >>> 0;
	return (~crc) >>> 0;
}

/** Déchiffre/chiffre un buffer en place (clé entière 32 bits). */
export function decryptCriware(data: Uint8Array, fileName: string): Uint8Array {
	const key = crcKeyFromFileName(fileName);
	return decryptCriwareWithKey(data, key);
}

/** Déchiffre avec une clé numérique explicite. */
export function decryptCriwareWithKey(data: Uint8Array, key: number): Uint8Array {
	const result = new Uint8Array(data);
	const k0 = key & 0xff;
	const k1 = (key >>> 8)  & 0xff;
	const k2 = (key >>> 16) & 0xff;
	const k3 = (key >>> 24) & 0xff;

	let i = 0;
	const len = result.length;
	let baseOffset = 0;

	while (i + 4 <= len) {
		const crc = updateCrcStateFast(baseOffset, k0, k1, k2, k3);
		result[i]!     ^= computeXorByte(crc, 0);
		result[i + 1]! ^= computeXorByte(crc, 1);
		result[i + 2]! ^= computeXorByte(crc, 2);
		result[i + 3]! ^= computeXorByte(crc, 3);
		i += 4;
		baseOffset += 4;
	}

	if (i < len) {
		const crc = updateCrcStateFast(baseOffset, k0, k1, k2, k3);
		for (let pos = 0; i < len; i++, pos++)
			result[i]! ^= computeXorByte(crc, pos);
	}

	return result;
}

function updateCrcStateFast(seed: number, k0: number, k1: number, k2: number, k3: number): number {
	let crc = (~seed) >>> 0;
	crc = ((crc >>> 8) ^ (CRC32_TABLE[((crc ^ k0) & 0xff)]!)) >>> 0;
	crc = ((crc >>> 8) ^ (CRC32_TABLE[((crc ^ k1) & 0xff)]!)) >>> 0;
	crc = ((crc >>> 8) ^ (CRC32_TABLE[((crc ^ k2) & 0xff)]!)) >>> 0;
	crc = ((crc >>> 8) ^ (CRC32_TABLE[((crc ^ k3) & 0xff)]!)) >>> 0;
	return (~crc) >>> 0;
}

function computeXorByte(crc: number, position: number): number {
	const baseShift = position * 2;
	let r8 = (crc >>> (baseShift + 8)) & 3;
	r8 |= ((crc >>> baseShift) & 0xff) << 2 & 0xff;
	r8  = ((r8 << 2) & 0xff) | ((crc >>> (baseShift + 16)) & 3);
	r8  = ((r8 << 2) & 0xff) | ((crc >>> (baseShift + 24)) & 3);
	return r8 & 0xff;
}
