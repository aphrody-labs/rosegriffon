# Rapport d'Audit & Recommandations n2b (Node -> Bun) — Session Brain Mirror

> **Date :** 2026-09-09T03:17:00Z
> **Outil :** `n2b` CLI (v0.6.2)
> **Cible analysée :** Le cerveau de l'agent, ses rituels de travail et l'espace `~/.aphrody`.

## 1. Principes Cardinaux n2b à graver en Mémoire Pure

1. **Standard Web et Buffers :**
   - Remplacer systématiquement `Buffer.alloc(n)` par `new Uint8Array(n)`.
   - Remplacer `Buffer.concat([a, b])` par la concaténation de TypedArrays standards ou `Bun.concatArrayBuffers`.
   - Éviter d'importer le module `node:buffer` quand les primitives globales Web (`Uint8Array`, `ArrayBuffer`, `DataView`) suffisent.

2. **I/O Système Ultra-Performant avec Bun Natif :**
   - Utiliser `Bun.file(path).text()` et `Bun.write(path, data)` à la place de `fs.readFileSync` et `fs.writeFileSync`.
   - Utiliser `Bun.serve()` pour les micro-serveurs HTTP/WebSocket au lieu de `http.createServer` ou Express.
   - Utiliser `bun:sqlite` avec `PRAGMA journal_mode = WAL` pour tout stockage relationnel et recherche FTS5 (déjà actif dans `knowledge.db`).

3. **Exécution de Shell & Processus :**
   - Utiliser `import { $ } from 'bun'` pour lancer des sous-commandes de façon sécurisée et rapide plutôt que `child_process.exec` ou `child_process.spawn`.

4. **Audit sur `workspace/skills/toriyama-svg` :**
   - Fichier audité : `scripts/icones.ts`.
   - Findings identifiés : utilisation de `Buffer.alloc` et `Buffer.concat` pour l'assemblage binaire de l'en-tête ICO.
   - Action : Conversion propre vers `Uint8Array` et manipulation d'octets purement Web-standard.
