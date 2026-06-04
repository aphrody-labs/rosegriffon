# @rose-griffon/iecode-core

Pont Bun ↔ **IECODE.Core** (.NET 10) via `node-api-dotnet`. Charge l'assembly
`IECODE.Core.dll` et projette **tout** son API public dans Bun :
`loadIecode().IECODE.Core.*`, `loadIecode().System.*`, etc.

```ts
import { loadIecode, iecodeCore } from "@rose-griffon/iecode-core";

const core = iecodeCore();                 // namespace IECODE.Core projeté
const cat = core.Formats.FormatCatalog;    // catalogue de formats
console.log(cat.ToJson());                 // JSON stable et versionné
```

Prérequis : `bun run build:dotnet` (compile `IECODE.Core.dll` Release net10.0) et le
paquet `node-api-dotnet` construit (`bun run napi:build` à la racine iecode).

## Catalogue de formats — savoir machine-readable pour `niers`

`niers` (`/home/ubuntu/niers`) est **full-Rust** : il ne peut pas appeler le .NET. Il
**consomme le savoir** d'iecode sur les formats binaires LEVEL-5 / CRIWARE d'IEVR sous
forme d'un **artefact JSON stable et versionné**, ingéré comme ancres de vérité par
`nie-seed`.

### Produire le catalogue

Depuis le CLI .NET (`iecode`) :

```sh
# vers stdout
dotnet run --project iecode/src/IECODE.CLI -- export-knowledge

# vers un fichier
dotnet run --project iecode/src/IECODE.CLI -- export-knowledge --out catalogue.json
```

Ou depuis Bun, via l'API projetée :

```ts
import { iecodeCore } from "@rose-griffon/iecode-core";
import { write } from "bun";

const json = iecodeCore().Formats.FormatCatalog.ToJson();
await write("catalogue.json", json);
```

### API publique C# (`IECODE.Core.Formats.FormatCatalog`)

| Membre | Rôle |
|---|---|
| `FormatCatalog.SchemaVersion` (`const int`) | version du schéma JSON émis (actuellement **1**) |
| `FormatCatalog.All` (`IReadOnlyList<FormatDefinition>`) | catalogue complet, ordre canonique |
| `FormatCatalog.Get(string name)` | définition d'un format par nom canonique, ou `null` |
| `FormatCatalog.BuildDocument()` | document racine versionné (non sérialisé) |
| `FormatCatalog.ToJson()` | JSON stable et versionné (indenté, AOT-safe via source-gen) |

Types : `FormatDefinition`, `FormatField`, `FormatCatalogDocument`, et les enums
`FormatCategory`, `FormatEndianness`. Tous documentés en français (`///`).

### Schéma JSON (`schema_version: 1`)

```jsonc
{
  "schema_version": 1,
  "generator": "iecode",
  "game": "Inazuma Eleven: Victory Road",
  "format_count": 31,
  "formats": [
    {
      "name": "G4TX",                       // clé canonique stable
      "category": "Texture",                // Archive|Model|Texture|Material|Animation|
                                            //   Config|Audio|Video|Compression|Script|Spatial
      "extensions": ["g4tx"],
      "magic": "\"G4TX\"",                  // magic lisible (ASCII/hex), ou null
      "magic_hex": 1481913415,              // uint32 LE (ordre disque), ou null
      "endianness": "Little",               // Little|Big|None
      "header_size": 96,                    // taille en-tête fixe (octets), ou absent
      "description": "Conteneur de textures LEVEL-5 …",
      "doc": "Formats/Level5/G4txParser.cs",// parser de référence (relatif à IECODE.Core/)
      "fields": [                           // layout des champs d'en-tête (peut être vide)
        { "offset": 0, "size": 4, "type": "magic", "name": "Magic", "note": "\"G4TX\" (0x58543447 LE)" },
        { "offset": 4, "size": 2, "type": "i16",   "name": "HeaderSize", "note": "taille de l'en-tête (0x60)" }
      ]
    }
  ]
}
```

Formats couverts (31) : **archives/conteneurs** CPK, @UTF, ACB, AWB, G4PK, G4PKM,
G4RA, XFSA, XPCK ; **modèles** G4MD, G4MG, G4MT, G4SK, G4NV, PXCL ; **textures**
G4TX, NXTCH, DDS, DXBC ; **animation** AGI, P3LIP ; **config/données** cfg.bin, RDBN,
MEVBIN, FXBIN, OBJB ; **scripts** LUA ; **compression** CRILAYLA ; **audio/vidéo**
HCA, ADX, USM.

Les offsets et layouts sont extraits des parsers de `Formats/**` et `Audio/**`
(vérifiés octet par octet sur fichiers réels) — aucune valeur n'est fabriquée.

### Consommation côté `niers`

`nie-seed` lit ce JSON et l'ingère dans la base de connaissance sqlite
(`nie-index`) :

- chaque format → table `format` (`name`, `magic`, `source = "iecode-catalog"`, `doc`) ;
- chaque champ → table `format_field` (`offset`, `size`, `ty`, `name`, `note`).

Ingesteur : `crates/nie-seed/src/format_catalog.rs`
(`ingest_format_catalog(db, path)`), branché dans `nie_seed::ingest_all(..)` via un
paramètre optionnel `format_catalog_json`. Idempotent ; rejette toute
`schema_version` non supportée.

```sh
# 1. produire le catalogue depuis iecode
dotnet run --project iecode/src/IECODE.CLI -- export-knowledge --out /tmp/iecode-format-catalog.json

# 2. l'ingérer côté niers (nightly requis pour la std wasm)
export PATH="$HOME/.rustup/toolchains/nightly-2026-05-17-x86_64-unknown-linux-gnu/bin:$PATH"
cargo test -p nie-seed
```

**Compatibilité** : toute rupture du schéma JSON (suppression/renommage de champ,
changement de sémantique) DOIT incrémenter `FormatCatalog.SchemaVersion` côté C# **et**
`SUPPORTED_SCHEMA_VERSION` côté `nie-seed`.
