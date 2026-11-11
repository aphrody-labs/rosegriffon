# `third_party/` — les sources tierces vendorisées

Ce dossier contient les petites bibliothèques C/C++ **header-only** compilées dans le toolkit
`iecode`, ainsi que les sources upstream complètes conservées pour étudier et adapter des SDK
homebrew et bibliothèques C. Les snapshots de SDK et Lua ne sont pas intégrés à la cible CMake
hôte; leurs adaptateurs IECODE seront maintenus à part.

| Chemin                                     | Bibliothèque                                | Licence              | Ce qu'on en fait                                  |
| ------------------------------------------ | ------------------------------------------- | -------------------- | ------------------------------------------------- |
| `stb/stb_image.h`, `stb/stb_image_write.h` | stb (Sean Barrett)                          | domaine public / MIT | lire et écrire du PNG dans les converters         |
| `bcdec/bcdec.h`                            | bcdec (Sergii Kudlai)                       | domaine public / MIT | décoder les blocs BC (dont BC7) des textures G4TX |
| `mio/mio.hpp`                              | mio (mandreyel)                             | MIT                  | projection mémoire portable des gros fichiers     |
| `tinygltf/tiny_gltf.h`                     | TinyGLTF (Syoyo Fujita, Aurélien Chatelain) | MIT                  | écrire du glTF à l'export des modèles             |

Le texte complet de chaque licence est dans l'en-tête du fichier concerné ou dans le fichier
de licence local. L'inventaire central est [`THIRD_PARTY.md`](../../../THIRD_PARTY.md).

## Règles

- **On ne modifie pas une source vendorisée.** Un correctif local se perd à la mise à jour
  et rend le fichier incomparable à l'amont. Ce qui doit changer se met dans un
  en-tête d'enrobage, du côté d'`iecode`.
- **Mettre à jour = remplacer le fichier, et rien d'autre**, puis relancer les tests du
  toolkit. Noter la version amont dans le même commit.
- **Toute entrée nouvelle ici ajoute une ligne dans `THIRD_PARTY.md`.** Une source redistribuée
  sans attribution est un défaut de licence, pas un oubli de documentation.
- Les dépendances qui _ne sont pas_ copiées (Cargo, Bun, NuGet, vcpkg) n'ont rien à faire
  ici : elles se résolvent à la construction.
- Les arbres upstream complets gardent leurs fichiers et licences d'origine. Leur dépôt,
  révision et sous-modules sont consignés dans [`CONSOLE-SDKS.md`](CONSOLE-SDKS.md); les
  adaptations IECODE restent hors de ces arbres.
- Les révisions et licences des bibliothèques graphiques 3DS sont listées dans
  [`3ds/CONSOLE-SDKS.md`](3ds/CONSOLE-SDKS.md).
