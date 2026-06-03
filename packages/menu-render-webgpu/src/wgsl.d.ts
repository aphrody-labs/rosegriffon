// Import de fichiers WGSL comme texte brut (Bun : `with { type: "text" }`).
declare module "*.wgsl" {
	const source: string;
	export default source;
}
