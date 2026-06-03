/// <reference path="../types/IECODE.Core.d.ts" />
/**
 * @rose-griffon/iecode-core — accès Bun à **tout** IECODE.Core (.NET 10) via node-api-dotnet.
 *
 * `dotnet.load()` charge l'assembly et **fusionne tous ses namespaces** dans le
 * module : l'intégralité de l'API publique de IECODE.Core (et de .NET) est
 * accessible depuis Bun — `dotnet.IECODE.Core.*`, `dotnet.System.*`, etc.
 *
 * Prérequis : `bun run build:dotnet` (→ IECODE.Core.dll Release net10.0) et le
 * paquet node-api-dotnet construit (`bun run napi:build` à la racine).
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** Assembly IECODE.Core compilé (Release, net10.0). */
export const IECODE_CORE_DLL = join(
	import.meta.dir,
	"../../../src/IECODE.Core/bin/Release/net10.0/IECODE.Core.dll"
);

const CORE_DIR = dirname(IECODE_CORE_DLL);
const require = createRequire(import.meta.url);

/** Module node-api-dotnet, augmenté des namespaces IECODE.Core (cf. types/IECODE.Core.d.ts). */
type Dotnet = typeof import("node-api-dotnet");
let _dotnet: Dotnet | undefined;

/**
 * Charge IECODE.Core (et résout ses dépendances depuis son dossier de build),
 * puis renvoie le module .NET avec tous les namespaces projetés **typés**.
 * Accès : `loadIecode().IECODE.Core.<Type>`, `loadIecode().System.*`, …
 */
export function loadIecode(): Dotnet {
	if (_dotnet) return _dotnet;
	// Le host node-api-dotnet cible net8/net9 ; on autorise le roll-forward
	// vers le runtime .NET 10 installé. Doit être posé AVANT l'init du CLR.
	process.env["DOTNET_ROLL_FORWARD"] ??= "LatestMajor";
	const dotnet = require("node-api-dotnet") as Dotnet;
	// Résout les assemblies dépendantes (ImageSharp, EF Core, SharpGLTF, …)
	// depuis le dossier de sortie de IECODE.Core.
	dotnet.addListener("resolving", (name: string, _v: string, resolve: (p: string) => void) => {
		const candidate = join(CORE_DIR, `${name}.dll`);
		if (existsSync(candidate)) resolve(candidate);
	});
	dotnet.load(IECODE_CORE_DLL);
	_dotnet = dotnet;
	return dotnet;
}

/** Raccourci vers le namespace IECODE.Core projeté (tout l'API). */
export function iecodeCore(): any {
	return loadIecode().IECODE.Core;
}
