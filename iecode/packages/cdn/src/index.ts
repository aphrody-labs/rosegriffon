/**
 * @rose-griffon/iecode-cdn — accès Bun au CDN d'assets menu **azalee**.
 *
 * Produit / sert l'arbre exact attendu par azalee
 * (`cdn.rosegriffon.fr/dx11/menu/**.png`) en décodant les conteneurs G4TX du jeu en PNG
 * **lossless pleine résolution** (mip 0), sans dump préalable et SANS jamais écrire en prod.
 *
 * Tout le travail lourd (résolution chemin azalee → conteneur G4TX + sous-texture, décodage
 * BCn/DDS → RGBA, encodage PNG) vit dans `IECODE.Core.Cdn.*` (.NET), exposé via la façade
 * Bun-friendly `IECODE.Core.Cdn.MenuCdnBridge` (classes/byte[] — pas de record struct / out
 * param, que node-api-dotnet ne projette pas). Ce module n'est qu'un pont mince.
 *
 * Contrat azalee (cf. AZALEE ASSET CONTRACT) — règle universelle vérifiée sur l'install réel :
 *   `dx11/menu/<dir>/{stem}_{texname}.png`  ⟷  conteneur `data/dx11/menu/<dir>/{stem}.g4tx`,
 *   (sous-)texture interne `{texname}`. Ex.
 *     face     c01000010 → face/c01000010_l.g4tx           tex c01000010_1_l00
 *     uniform  u…         → uniform/u…_l.g4tx               tex …_1 (front) / _2 (back)
 *     aura_fs  k{6}       → aura_fs/k{6}_l.g4tx             tex k{6}_l00
 *     aura_soul a{6}      → aura_soul/a{6}_l.g4tx           tex a{6}_l00
 *     emblem   em{4}      → 01_icon_emblem/em{4}.g4tx       tex em{4}
 *     item     code       → 02_icon_item/icon_itemNN.g4tx   tex <code> (atlas)
 *     telop    code       → 220_img/telop_waza[/lang]/code.g4tx  tex <code>
 */
import { iecodeCore } from "@rose-griffon/iecode-core";

/** Référence résolue : conteneur G4TX (chemin logique CPK) + nom de (sous-)texture + chemin azalee. */
export interface MenuAssetRef {
	containerPath: string;
	textureName: string;
	azaleePath: string;
}

/** Une icône menu décodée : PNG lossless + dimensions natives + ETag immuable. */
export interface MenuPng {
	azaleePath: string;
	bytes: Uint8Array;
	width: number;
	height: number;
	etag: string;
}

/** Compte-rendu d'un export batch. */
export interface MenuExportReport {
	containers: number;
	pngWritten: number;
	failed: number;
	bytesWritten: number;
	outputRoot: string;
}

/**
 * Ouvre le CDN menu pour un jeu IEVR installé. `gamePath` défaut = install Steam détecté.
 * Le retour expose résolution, rendu PNG à la demande et export batch — le tout adossé aux CPK,
 * sans dump et sans toucher la prod.
 */
export function openMenuCdn(gamePath?: string): MenuCdn {
	const bridge = iecodeCore().Cdn.MenuCdnBridge.Open(gamePath ?? null);
	return new MenuCdn(bridge);
}

/** Façade Bun mince autour de `IECODE.Core.Cdn.MenuCdnBridge`. */
export class MenuCdn {
	// eslint-disable-next-line no-useless-constructor
	constructor(private readonly bridge: any) {}

	/** BuildId Steam (ETag racine). */
	get buildId(): string {
		return this.bridge.BuildId;
	}

	/** Nombre total de conteneurs G4TX du sous-arbre menu. */
	get containerCount(): number {
		return this.bridge.MenuContainerCount;
	}

	/** Résout un chemin azalee → conteneur + texture (n'ouvre aucun CPK). null si inconnu. */
	resolve(azaleePath: string): MenuAssetRef | null {
		const a = this.bridge.Resolve(azaleePath);
		if (a == null) return null;
		return { containerPath: a.ContainerPath, textureName: a.TextureName, azaleePath: a.AzaleePath };
	}

	/** Décode une icône azalee en PNG lossless. null si conteneur introuvable. */
	async render(azaleePath: string): Promise<MenuPng | null> {
		const m = await this.bridge.RenderAsync(azaleePath);
		return m == null ? null : toMenuPng(m);
	}

	/** Décode toutes les (sous-)textures d'un conteneur en PNG (atlas → N PNG). */
	async renderAll(containerLogicalPath: string): Promise<MenuPng[]> {
		const list = await this.bridge.RenderAllAsync(containerLogicalPath);
		return toArray(list).map(toMenuPng);
	}

	/**
	 * Matérialise (une partie de) l'arbre `dx11/menu/**.png` vers `outputRoot`, dans la même
	 * arborescence que celle servie par nginx (alias `dx11/menu/` → ce dossier). `filter` =
	 * sous-chaîne de chemin de conteneur (ex. `"face"`, `"telop_waza/fr"`).
	 */
	async exportTree(
		outputRoot: string,
		opts: { filter?: string; overwrite?: boolean; concurrency?: number } = {}
	): Promise<MenuExportReport> {
		const r = await this.bridge.ExportAsync(
			outputRoot,
			opts.filter ?? null,
			opts.overwrite ?? false,
			opts.concurrency ?? 0
		);
		return {
			containers: r.Containers,
			pngWritten: r.PngWritten,
			failed: r.Failed,
			bytesWritten: Number(r.BytesWritten),
			outputRoot: r.OutputRoot,
		};
	}

	/** Liste les conteneurs G4TX du sous-arbre menu (chemins logiques CPK). */
	listContainers(filter?: string): string[] {
		return toArray(this.bridge.ListContainers(filter ?? null));
	}

	/**
	 * Sert n'importe quel fichier du CPK par son chemin logique (ex. `data/dx11/menu/face/c01000010_l.g4tx`).
	 * Renvoie `null` si le chemin est inconnu de l'index (→ 404). Octets natifs bruts.
	 */
	async readRaw(path: string): Promise<CdnRawFile | null> {
		const f = await this.bridge.ReadRawAsync(path);
		if (f == null) return null;
		return {
			path: f.Path,
			bytes: Uint8Array.from(f.Bytes as number[]),
			mediaType: f.MediaType,
			etag: f.ETag,
		};
	}

	dispose(): void {
		this.bridge.Dispose?.();
	}
}

/** Un fichier brut du CPK : octets natifs déchiffrés/décompressés, media-type et ETag immuable. */
export interface CdnRawFile {
	path: string;
	bytes: Uint8Array;
	mediaType: string;
	etag: string;
}

/** Un `List<T>`/`T[]` .NET se projette en JS Array ; tolère aussi l'API indexée. */
function toArray<T>(list: any): T[] {
	if (Array.isArray(list)) return list as T[];
	const n: number = list.Count ?? list.length ?? 0;
	const out: T[] = [];
	for (let i = 0; i < n; i++) out.push(list.get_Item ? list.get_Item(i) : list[i]);
	return out;
}

function toMenuPng(m: any): MenuPng {
	// m.Bytes (byte[] .NET) se projette en JS Array de nombres → Uint8Array natif.
	return {
		azaleePath: m.AzaleePath,
		bytes: Uint8Array.from(m.Bytes as number[]),
		width: m.Width,
		height: m.Height,
		etag: m.ETag,
	};
}
