// Déclaration ambiante pour @casl/ability : moduleResolution=Node ne résout pas
// les exports map du package (types uniquement exposés sous "exports['.']['types']").
// Cette déclaration permet l'import typé sans modifier la résolution globale.
declare module "@casl/ability" {
	export * from "@casl/ability/dist/types/index";
}
