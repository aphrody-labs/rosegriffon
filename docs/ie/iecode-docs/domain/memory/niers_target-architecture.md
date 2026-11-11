# Niers & Nie VFS Architecture

- Spécification : Monorepo Rust / Wasm Inazuma Eleven VR, suite Inacord, binaire `nie.exe`.
- Virtual File System (crates/nie-vfs) :
  - Abstraction unifiée des archives de jeu, RAM-backed VFS, montage en mémoire.
  - Formats conteneurs Level-5 G4 : `.g4md` (modèles), `.g4mg` (géométrie), `.g4pkm` (packages), `.pck`.
  - Intégration SQLite (var/niers.sqlite, var/mirror.sqlite) pour indexation haute vitesse des offsets et hashes.
- nie-web : Compilation WebAssembly de `nie.exe` pour exécution côté navigateur.
- Contrat architectural verrouillé dans TARGET-ARCHITECTURE.md.
