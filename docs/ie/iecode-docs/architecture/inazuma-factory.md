# Architecture de l'Usine Inazuma (IECODE Factory)

Ce document établit l'architecture officielle de l'**Usine Inazuma** au sein du monorepo `iecode`, standardisée selon les exigences strictes d'Aphrody et de Rose Griffon.

`iecode` constitue la source de vérité autoritaire et factuelle pour l'ingénierie inversée, le minage de données, la compilation WebAssembly et le rendu graphique d'Inazuma Eleven: Victory Road (`IEVR`).

---

## Les 4 Piliers de l'Usine

```
+-------------------------------------------------------------------------+
|                        IECODE INAZUMA FACTORY                           |
+-------------------+-----------------+-----------------+-----------------+
|   1. Grounding    |     2. GPU      |     3. WASM     | 4. Data Mining  |
|    Byte-Exact     |    & Shaders    |     Target      |   & Extraction  |
+-------------------+-----------------+-----------------+-----------------+
| nie-bridge        | WGPU 30         | wasm32-unknown  | nie-formats     |
| Level-5 RDBN      | Naga WGSL       | wasm-bindgen    | nie-re & dump   |
| G4TX & DDS        | Bevy 0.19.1       | Pure Rust parsers| nie-zukan      |
| CPK & @UTF        | aphrody-render3d| CPU Rasterizer  | nie-save        |
+-------------------+-----------------+-----------------+-----------------+
```

### 1. Ancrage Factuel et Byte-Exact (`nie-bridge`)

Les packages TypeScript (`@rosegriffon/azalee`, `@rosegriffon/inagle`, `@rosegriffon/inagle-cross`) ne reposent plus sur des approximations heuristiques, mais sont strictement reliés aux formats binaires réels de Level-5 implémentés dans `aphrody-nie-formats` :

- **RDBN / `cfg.bin`** :
  - Signature magique little-endian `0x4E424452` (`RDBN`).
  - En-tête canonique de 80 octets (`0x50`), version `100` (`0x64`).
  - Tables de types, champs, racines alignées sur 32 octets (`0x20`).
- **G4TX / Conteneur de Textures** :
  - Signature magique little-endian `0x58543447` (`G4TX`).
  - En-tête de 96 octets (`0x60`), fileType `0x65`.
  - Calcul d'offsets de tables conforme à `aphrody-nie-formats/src/g4tx.rs` :
    - `sub_entry_offset = entry_offset + texture_count * 0x30`
    - `hash_offset = align16(sub_entry_offset + sub_texture_count * 0x18)`
    - `id_offset = hash_offset + total_count * 4`
    - `string_offset = align4(id_offset + total_count)`
- **CPK & @UTF** :
  - Signature `0x204B5043` (`CPK `) sur secteur de 2048 octets (`0x800`).
  - Descripteur de table de métadonnées `@UTF` (`0x40555446`).
- **Polynôme CRC32 Level-5** :
  - Implémentation conforme au polynôme standard IEEE 802.3 `0xEDB88320`.

### 2. Moteur GPU & Shaders

- **WGPU 30 & Naga** : Validation statique et compilation des shaders WGSL.
- **Rastériseur CPU Pur Rust** : `aphrody-nie-render3d` intègre un rastériseur logiciel indépendant du GPU hôte pour des rendus déterministes et la validation de tests golden.
- **Présentation WebGPU** : Intégration optionnelle du canvas via la feature `webgpu` de `aphrody-nie-wasm`.

### 3. Cible WebAssembly Pure (`wasm32-unknown-unknown`)

- **Gating Strict des Features Hôte** :
  - Désactivation de `mlua` et de la VM C Lua pour `wasm32-unknown-unknown`. Seul le désassembleur et décodeur de bytecode pur Rust (`aphrody_nie_lua::bytecode`) est embarqué côté navigateur.
  - Découplage de Tokio, SQLite et Redis via `default-features = false` sur l'ensemble des crates NIE (`aphrody-nie-explore`, `model-serve`, `tasks`, `queue`, `steam`, `re`, `trace`, `camera`, etc.).
- **Compatibilité Totale Navigateur** :
  - `cargo check -p aphrody-nie-wasm --target wasm32-unknown-unknown` is the scoped compilation gate; this document does not establish a current execution result.
  - Export de `WasmMatch`, `WasmGame`, inspection PE et parsing VFS sans dépendance externe.

### 4. Suite de Minage et d'Extraction de Données

- Extraction automatique des statistiques, compétences, techniques et modèles 3D.
- Current membership comes from root manifests and `workspace.manifest.json`;
  the 2026-10-03 workspace gate reports 74 Rust packages and 6 Bun members.
  Membership and narrow hygiene checks do not qualify the complete gate graph.
- The [current Inagle/NIE FFI boundary](../development/INAGLE-NIE-FFI.md)
  describes actual memory ownership, native availability and evidence limits.
