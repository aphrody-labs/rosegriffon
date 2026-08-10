import "server-only";

/**
 * Index des 250 800 fichiers des CPK (SQLite matérialisé au runtime).
 *
 * Façade Next au-dessus de `@rose-griffon/azalee/cpk` : la logique vit dans
 * la bibliothèque (utilisable en CLI et en sidecar Tauri), ce fichier n'ajoute
 * que la garde `server-only`.
 */

export * from "@rose-griffon/azalee/cpk";
