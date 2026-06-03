/// <reference types="@webgpu/types" />

// Le renderer `@rose-griffon/menu-render-webgpu` est consommé en **source** (workspace),
// donc le `tsc` d'azalee descend dans ses modules. Deux constructs y ont besoin d'un ambient :
//   - l'import du shader WGSL en texte (`import s from "./shaders.wgsl" with { type: "text" }`) ;
//   - les types globaux WebGPU (`GPUDevice`, `GPUTextureUsage`, `navigator.gpu`, …) fournis par
//     `@webgpu/types` (référencé ci-dessus, augmente aussi `HTMLCanvasElement.getContext`).

declare module "*.wgsl" {
	const source: string;
	export default source;
}

// `@rose-griffon/menu-render` (réexporté par menu-render-webgpu) tire le runtime Lua
// `@rose-griffon/iecode-inagle`, qui consomme `fengari` (VM Lua) — paquet sans typings.
// L'ambient évite le TS7016 dans le graphe d'azalee sans toucher au package upstream.
// `LuaState` est importé en tant que *type* par le runtime → on l'expose comme type opaque.
declare module "fengari" {
	export type LuaState = unknown;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const fengari: any;
	export default fengari;
}
declare module "fengari-interop";
