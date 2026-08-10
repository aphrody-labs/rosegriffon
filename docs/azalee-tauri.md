# Azalée dans une application Tauri v2 — sidecar Bun et client distant

> **Cap** : `@rose-griffon/azalee` doit alimenter une application de bureau **même quand la machine de
> l'utilisateur n'a ni miroir SQLite ni dump du jeu**. La bibliothèque expose donc deux voies vers les
> mêmes 41 routes : un **sidecar Bun** local (données du disque, zéro réseau) et un **client HTTP typé**
> vers l'API publique. Le choix entre les deux est automatique.

Tout ce qui suit a été exécuté sur ce dépôt le 2026-08-10 ; les sorties reproduites sont réelles.

## 1. Vue d'ensemble

```
┌───────────────────────── application Tauri v2 ─────────────────────────┐
│                                                                        │
│  webview (bundle navigateur)                                           │
│    @rose-griffon/azalee            → règles de jeu, URLs CDN, i18n,     │
│                                      recherche floue (2,67 Mo)         │
│    @rose-griffon/azalee/remote     → client HTTP typé (12,2 Ko)        │
│            │                                                           │
│            │ resolveAzaleeBaseUrl([sidecar, api publique])             │
│            ▼                                                           │
│    ┌───────────────┐            ┌──────────────────────────────────┐   │
│    │ sidecar Bun   │            │ https://api.rosegriffon.fr       │   │
│    │ 127.0.0.1:P   │  ou repli  │        /azalee                   │   │
│    │ azalee serve  │───────────▶│ (même serve.ts, données du VPS)  │   │
│    └───────┬───────┘            └──────────────────────────────────┘   │
│            │ bun:sqlite + artefacts locaux                             │
│  ┌─────────▼──────────┐                                                │
│  │ mirror.sqlite      │  absents sur la machine d'un joueur            │
│  │ cpk-index.ndjson.gz│  → /health renvoie mirror:null → repli distant │
│  └────────────────────┘                                                │
└────────────────────────────────────────────────────────────────────────┘
                       ▲ images, modèles 3D : cdn.rosegriffon.fr
```

Les deux voies servent **le même code** : `handleAzaleeRequest` (`src/server/serve.ts`) est une fonction
pure `Request → Response`, et le client accepte n'importe quel transport. Aucune logique n'est dupliquée.

## 2. Compiler le sidecar

Le CLI se compile en binaire autonome embarquant le runtime Bun ; il tourne sans `node_modules`.

```bash
bun run --cwd packages/azalee compile        # → packages/azalee/bin/azalee (80 Mo)
```

Tauri exige un binaire suffixé par le **triplet cible** de la plateforme. Le triplet se lit avec
`rustc --print host-tuple` (Rust ≥ 1.84 ; avant, `rustc -vV | grep host | cut -f2 -d' '`).

```bash
TRIPLE=$(rustc --print host-tuple)           # x86_64-unknown-linux-gnu ici
mkdir -p src-tauri/binaries
bun build --compile --minify packages/azalee/src/cli.ts \
  --outfile "src-tauri/binaries/azalee-$TRIPLE"
```

Vérifié : le binaire produit démarre l'API complète.

```
$ ./azalee-x86_64-unknown-linux-gnu serve --port 3013
azalee serve url=http://127.0.0.1:3013 routes=41
```

Pour un sidecar minimal (sans le reste du CLI), `packages/azalee/src/server/main.ts` est un point
d'entrée dédié qui ne fait que `createAzaleeServer` — même compilation, binaire plus petit.

### Compilation croisée

`bun build --compile --target=bun-<os>-<arch>` produit le binaire d'une autre plateforme
(`bun-linux-x64`, `bun-darwin-arm64`, `bun-windows-x64`…). Il faut ensuite le renommer avec le triplet
Rust correspondant (`x86_64-unknown-linux-gnu`, `aarch64-apple-darwin`, `x86_64-pc-windows-msvc`, avec
l'extension `.exe` sous Windows) : les deux nomenclatures ne coïncident pas, c'est l'erreur classique.

## 3. `tauri.conf.json`

```jsonc
{
  "bundle": {
    // Tauri cherche `binaries/azalee-<triplet>` (+ `.exe` sous Windows)
    "externalBin": ["binaries/azalee"]
  },
  "app": {
    "security": {
      "csp": {
        "default-src": "'self'",
        // ipc: + ipc.localhost = IPC Tauri ; puis le sidecar ET l'API publique.
        // Sans cette ligne, le fetch de la webview est bloqué par la CSP.
        "connect-src": "ipc: http://ipc.localhost http://127.0.0.1:3010 https://api.rosegriffon.fr https://cdn.rosegriffon.fr",
        // Les URLs d'assets résolues par la lib (visages, emblèmes, illustrations)
        // pointent toutes sur le CDN.
        "img-src": "'self' data: blob: https://cdn.rosegriffon.fr",
        "style-src": "'self' 'unsafe-inline'"
      }
    }
  }
}
```

Points de vigilance :

- **La CSP n'est active que si elle est définie.** Tauri y ajoute automatiquement ses nonces et hachages
  pour le code embarqué ; il ne reste à déclarer que ce qui est propre à l'application.
- Une CSP ne comprend **pas** les ports génériques : `http://127.0.0.1:3010` autorise ce port et lui
  seul. Si le port du sidecar est tiré au sort (voir §6), soit on liste une plage explicite, soit on
  fixe le port au premier port libre connu à la compilation.
- `connect-src` doit inclure `https://cdn.rosegriffon.fr` dès qu'un visualiseur 3D charge un
  `/model-full/<code>.glb` par `fetch`, en plus de `img-src` pour les images.

## 4. Capacités (permissions)

Exécuter un sidecar depuis la webview réclame une permission explicite. Dans
`src-tauri/capabilities/default.json` :

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Fenêtre principale : sidecar Azalée",
  "windows": ["main"],
  "permissions": [
    "core:default",
    {
      "identifier": "shell:allow-execute",
      "allow": [
        {
          "name": "binaries/azalee",
          "sidecar": true,
          "args": ["serve", "--port", { "validator": "^\\d{4,5}$" }]
        }
      ]
    }
  ]
}
```

Le tableau `args` doit correspondre **exactement**, dans l'ordre, à ce que le code passe : les segments
statiques littéralement, les segments dynamiques par une expression régulière. `"args": true` autorise
tout — à éviter, c'est une porte d'exécution arbitraire. Le champ `name` reprend le chemin déclaré dans
`externalBin`, **sans** le suffixe de triplet.

Lancer le sidecar depuis Rust ne nécessite pas cette permission (elle protège l'IPC, donc la webview).

## 5. Cycle de vie du sidecar

Le plus sûr est de piloter le sidecar depuis Rust : la webview n'a alors besoin d'aucune permission
`shell`, et l'arrêt est garanti par le processus hôte.

```rust
use std::sync::Mutex;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

/// Handle du sidecar, conservé pour pouvoir le tuer à la fermeture.
struct Sidecar(Mutex<Option<CommandChild>>);

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let (mut rx, child) = app
                .shell()
                .sidecar("azalee")?
                .args(["serve", "--port", "3010"])
                .spawn()?;

            app.manage(Sidecar(Mutex::new(Some(child))));

            // Le sidecar écrit une ligne `azalee serve url=… routes=41` sur stdout :
            // c'est le signal de disponibilité le plus fiable.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use tauri::Emitter;
                use tauri_plugin_shell::process::CommandEvent;
                while let Some(event) = rx.recv().await {
                    if let CommandEvent::Stdout(line) = event {
                        let line = String::from_utf8_lossy(&line).to_string();
                        if line.starts_with("azalee serve") {
                            let _ = handle.emit("azalee://ready", line);
                        }
                    }
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("échec de construction")
        .run(|app, event| {
            // Sans cet arrêt explicite, le sidecar peut survivre à la fenêtre et
            // garder le port occupé : le lancement suivant échouerait.
            if let RunEvent::Exit = event {
                if let Some(state) = app.try_state::<Sidecar>() {
                    if let Some(child) = state.0.lock().unwrap().take() {
                        let _ = child.kill();
                    }
                }
            }
        });
}
```

`CommandChild::kill(self)` consomme le handle, d'où le `Option` + `take()`. Côté JavaScript,
l'équivalent est `const child = await Command.sidecar('binaries/azalee', [...]).spawn()` puis
`await child.kill()` — mais un rechargement de la webview perdrait la référence et laisserait un
processus orphelin. Préférer Rust.

## 6. Choix du port

`azalee serve` écoute sur `127.0.0.1:3010` par défaut (`AZALEE_PORT`, `AZALEE_HOST`). Ce port n'est pas
libre partout : sur le VPS de développement, `3010` est déjà pris par un autre service — l'application
doit donc gérer le conflit, pas le supposer absent.

Deux stratégies :

1. **Port fixe déclaré dans la CSP** (le plus simple). Choisir un port improbable (`31017`) et le
   déclarer dans `connect-src`. En cas de conflit, l'application affiche un diagnostic explicite.
2. **Port tiré au sort**, passé en argument et relu sur stdout. Il faut alors élargir `connect-src`, ce
   qui affaiblit la CSP — à réserver aux cas où le conflit est fréquent.

L'écoute sur `127.0.0.1` (défaut) et non `0.0.0.0` est délibérée : le sidecar ne doit pas être joignable
depuis le réseau local.

## 7. Appeler la lib depuis la webview

Le sous-chemin `/remote` est **client-safe** : aucun `node:*`, aucun `bun:*`. Preuve reproductible :

```
$ bun build --target=browser packages/azalee/src/remote/index.ts --outfile remote.js
Bundled 4 modules in 7ms
  remote.js  12.16 KB  (entry point)
```

```ts
import {
  AZALEE_DEFAULT_API_URL,
  createAzaleeClient,
  isAzaleeNotFound,
  resolveAzaleeBaseUrl,
} from "@rose-griffon/azalee/remote";
// La logique pure vient du bundle, jamais du réseau.
import { getCharacterFaceUrl, translateEffect } from "@rose-griffon/azalee";

const SIDECAR = "http://127.0.0.1:3010";

// Sonde /health sur chaque candidate, dans l'ordre. `requireLocalData` écarte un
// sidecar démarré sur une machine sans miroir SQLite ni dump du jeu.
const picked = await resolveAzaleeBaseUrl([SIDECAR, AZALEE_DEFAULT_API_URL], {
  timeoutMs: 1500,
  requireLocalData: true,
});

const azalee = createAzaleeClient({ baseUrl: picked?.baseUrl });

const { data, total } = await azalee.characters({ q: "Mark", limit: 24 });
const face = getCharacterFaceUrl(data[0]?.internalCode);

try {
  await azalee.character("slug-inconnu");
} catch (error) {
  if (isAzaleeNotFound(error)) {
    /* fiche absente — pas une panne */
  } else {
    throw error;
  }
}
```

Le client couvre les 41 routes (une méthode par route, vérifié par test), avec délai d'attente
(15 s par défaut), annulation (`AbortSignal`), reprise des échecs transitoires (`408`, `425`, `429`,
`5xx`, coupures réseau ; `Retry-After` honoré) et erreurs typées `AzaleeRemoteError`
(`kind: "http" | "network" | "timeout" | "abort" | "parse"`).

### En-têtes et CORS

Seuls `Accept` et `User-Agent` sont envoyés. `Accept` est un en-tête CORS sûr et `User-Agent` est un
en-tête interdit côté navigateur (donc retiré silencieusement) : aucun des deux ne déclenche de
pré-vol `OPTIONS`. **Ajouter un en-tête personnalisé en déclencherait un**, que la réponse
`Access-Control-Allow-Headers: Content-Type` de `serve.ts` refuserait. Passer plutôt les options
`fetch`/`transport` si l'authentification devient nécessaire.

## 8. Mode dégradé : ni base ni dump

C'est le cas nominal d'une application distribuée à un joueur. Mesuré avec le binaire compilé, lancé
depuis un dossier hors dépôt :

```
$ ./azalee-x86_64-unknown-linux-gnu serve --port 3013
$ curl -s http://127.0.0.1:3013/health
{"ok":true,"mirror":null,"dataDir":null,"cpkFiles":0}

$ curl -s http://127.0.0.1:3013/api/teams
{"error":"No SQLite database backup found"}
```

Le sidecar répond, mais ne sert rien : `mirror: null` est le signal. Avec le repli en place, sur les
mêmes processus (3013 = sidecar sans données, 3014 = tenant lieu d'API publique) :

```
sans_exigence= http://127.0.0.1:3013 mirror= null
avec_exigence= http://127.0.0.1:3014 cpk= 250800
teams= 208 characters= 21 -> Mark Evans
sidecar_sans_donnees: kind= http status= 500 detail= No SQLite database backup found
```

`requireLocalData: true` est donc **indispensable** : sans lui, la sonde retient le premier serveur qui
répond, y compris un sidecar vide.

Trois politiques possibles, par ordre de confort :

| Politique | Comportement | Quand |
| ----------- | -------------- | ------- |
| Sidecar seul | Rapide, hors ligne, mais inutilisable sans données | Poste de contributeur |
| Distant seul | Toujours des données, dépend du réseau | Application légère |
| Repli (recommandé) | Sidecar si données locales, sinon API publique | Distribution grand public |

### Côté serveur : `createAzaleeData`

Un CLI ou un service Bun n'a pas besoin de sonder en HTTP : `createAzaleeData` inspecte le disque et
choisit la source, avec la même surface de lecture que le client distant.

```ts
import { createAzaleeData } from "@rose-griffon/azalee/server";

const data = createAzaleeData();          // mode "auto"
console.log(data.source, "|", data.reason);
// local | source locale retenue : miroir SQLite présent (…/data/backups/mirror.sqlite)

const teams = await data.teams();         // 208 — lues sur le disque, zéro socket
```

En mode `auto` :

- artefacts présents → **local** (`handleAzaleeRequest` en appel direct, pas de socket) ;
- artefacts absents → **remote** (`fetch` vers `AZALEE_API_URL` ou `https://api.rosegriffon.fr/azalee`) ;
- lecture locale qui échoue (base hors ligne, miroir remplacé pendant une synchronisation) → bascule
  **à chaud** vers le distant, `data.isDegraded()` passe à `true` et les appels suivants partent
  directement à distance.

Un `404` ne déclenche jamais de bascule : c'est une réponse, pas une panne. Replier dessus ferait
apparaître des fiches absentes du miroir local et rendrait la source imprévisible.

## 9. Attendre la disponibilité

La matérialisation des index CPK et de texte se fait au **premier accès** (SQLite reconstruit en tmpfs).
`GET /health` renvoie `cpkFiles` une fois l'index prêt ; c'est la sonde à interroger avant le premier
appel de données.

```ts
import { probeAzaleeApi } from "@rose-griffon/azalee/remote";

for (let i = 0; i < 40; i++) {
  const health = await probeAzaleeApi(SIDECAR, { timeoutMs: 500 });
  if (health) break;
  await new Promise((r) => setTimeout(r, 250));
}
```

## 10. Ce qui a été vérifié

| Élément | Résultat |
| --------- | ---------- |
| `bun build --target=browser src/remote/index.ts` | 4 modules, 12,16 Ko, aucun `node:*`/`bun:*` |
| `bun build --target=browser src/index.ts` (racine) | 50 modules, 2,67 Mo — inchangé |
| Compilation du sidecar + suffixe de triplet | `azalee-x86_64-unknown-linux-gnu`, 80 Mo, démarre |
| Sidecar sans données locales | `/health` → `mirror:null`, `/api/teams` → 500 |
| Repli sidecar vide → API | `requireLocalData` écarte le sidecar, 208 équipes servies |
| Couverture des routes | 41/41, une méthode de client par route (test) |
| `bun test packages/azalee/test` | 225 passés, 0 échec |

## 11. Reste à faire (non implémenté)

- **Option `--remote` du CLI** : `src/cli.ts` appartient à un autre chantier. Le branchement se réduit à
  remplacer les appels directs à `wikiService`/`wiki/*` par `createAzaleeData({ mode })`, `mode` venant
  d'un drapeau `--source auto|local|remote` et d'un `--api-url`.
- **Cache disque côté client** : le repli distant rend l'application dépendante du réseau à chaque
  lancement. Un cache `stale-while-revalidate` (plugin `store` de Tauri ou `Cache` de la webview) sur
  les listes lourdes (`/api/teams`, `/api/passives`, `/api/text/stats`) supprimerait la latence de
  démarrage. La forme des réponses est stable et sérialisable en JSON.
- **Téléchargement du miroir** : plutôt que dépendre du réseau en permanence, l'application pourrait
  proposer de télécharger `mirror.sqlite` une fois puis basculer en local — `configureAzalee({ mirrorPath })`
  suffit à pointer dessus.
- **Projet Tauri de référence** : ce dépôt n'en contient pas encore. La recette ci-dessus est vérifiée
  au niveau du sidecar et du client, pas au niveau d'un `cargo tauri build` complet.

## Sources

- Tauri v2 — Embedding External Binaries : <https://v2.tauri.app/develop/sidecar/>
- Tauri v2 — Node.js as a sidecar (nommage, script de renommage) : <https://v2.tauri.app/learn/sidecar-nodejs/>
- Tauri v2 — Content Security Policy : <https://v2.tauri.app/security/csp/>
- Tauri v2 — Capabilities et permissions : <https://v2.tauri.app/security/capabilities/>
- Tauri v2 — Plugin Shell (`Command`, `CommandChild::kill`) : <https://v2.tauri.app/plugin/shell/>
- `tauri-apps/tauri-plugin-shell` — référence `Child`/`CommandChild` : <https://github.com/tauri-apps/tauri-plugin-shell>
- Bun — Single-file executable (`--compile`, `--target`) : <https://bun.com/docs/bundler/executables>
- `openapi-ts/openapi-fetch` — typage des réponses depuis le contrat, surface minimale :
  <https://github.com/openapi-ts/openapi-typescript/tree/main/packages/openapi-fetch>
- `octokit/request-error.js` — erreur HTTP typée (`status`, `response`, expurgation) :
  <https://github.com/octokit/request-error.js>
