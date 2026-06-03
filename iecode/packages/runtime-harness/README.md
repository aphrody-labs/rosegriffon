# @rose-griffon/iecode-runtime-harness

Harness d'exécution **live** d'IEVR sous Wine, headless, rendu logiciel LavaPipe,
confiné et nettoyable atomiquement. Conçu et **validé empiriquement** sur le VPS
cible (Ubuntu 26.04, systemd 259, cgroup v2, Mesa 26.0.3 lavapipe, wine/wine64,
`ptrace_scope=1`, 12 vCPU mono-thread Haswell AVX2).

> **À quoi ça sert (et à quoi ça ne sert PAS).** Ce harness est destiné UNIQUEMENT
> au reverse-engineering en direct (observer la mémoire d'un jeu qui tourne). **Le
> pipeline DATA n'en a pas besoin** : l'acquisition de données passe par
> l'extraction *statique* (SteamKit2 : download des depots + dump CPK via
> `@rose-griffon/iecode-core`), qui couvre l'intégralité des données de jeu sans jamais lancer
> le binaire. Lancer le jeu n'apporte rien au corpus ; il n'a de valeur que pour la
> RE live (résolution de structures, validation d'un parseur binaire contre la
> mémoire réelle).

## Briques

| Module | Rôle |
|---|---|
| `host.ts` | Détection des capacités (cgroup v2, contrôleurs délégués, lavapipe, wine, `ptrace_scope`, cœurs). |
| `cpu.ts` | Plan de partition CPU render/game/io (6/4/2 sur 12 cœurs) + préfixe `taskset`. |
| `vulkan.ts` | Env LavaPipe logiciel (`VK_DRIVER_FILES` + sélection ICD) + sonde `probeVulkan`. |
| `xvfb.ts` | Serveur X headless → `DISPLAY`. |
| `cgroup.ts` | Lancement confiné dans un scope transitoire délégué + **kill atomique** `cgroup.kill`. |
| `session.ts` | `GameSession` : orchestrateur idempotent avec handlers SIGINT/SIGTERM. |

## Exemple

```ts
import { GameSession } from "@rose-griffon/iecode-runtime-harness";

const session = new GameSession({
  command: ["wine", "/path/to/IEVR.exe"],
  memoryMaxBytes: 8 * 1024 ** 3,
  pidsMax: 1024,
});

await session.preflight();            // vérifie l'hôte, sans le jeu
const info = await session.start();   // Xvfb + env Vulkan + lancement confiné + pinning
console.log(info.pid, info.display, info.cgroupPath, info.cpu.renderCpus);

// … RE live ici : un worker C# ancêtre lit la mémoire via WineMemory …

await session.dispose();              // cgroup.kill atomique de TOUT l'arbre Wine
```

## Faits techniques validés sur l'hôte

- **Vulkan logiciel.** `VK_DRIVER_FILES=/usr/share/vulkan/icd.d/lvp_icd.json` suffit
  à sélectionner lavapipe (`vulkaninfo` → `DRIVER_ID_MESA_LLVMPIPE`,
  `PHYSICAL_DEVICE_TYPE_CPU`, `llvmpipe (LLVM 21.1.8)`).
  **Correction empirique** : `VK_LOADER_DRIVERS_SELECT` matche le **nom de manifest**
  (glob), pas le nom du driver — la valeur `lvp` est *rejetée*
  (« Driver lvp_icd.json ignored because not selected ») ; il faut `lvp_icd.json`
  (ou `*lvp*`). On dérive donc le select du basename de l'ICD.
- **LP_NUM_THREADS = cœurs render.** Le plan 12 cœurs donne render `6-11`
  (LP_NUM_THREADS=6), game `0-3`, io `4-5`. Pour un worker C# Server GC :
  `DOTNET_gcServer=1`, `DOTNET_GCHeapCount=0x6`, `DOTNET_GCHeapAffinitizeRanges="6-11"`.
- **Kill atomique.** Écrire `1` dans `cgroup.kill` SIGKILL tout le sous-arbre, gère
  les forks concurrents, sans course. Validé : après écriture, `cgroup.procs` est
  vide et le cgroup disparaît.
- **cpuset NON délégué.** Sous `user@<uid>.service`, seuls `cpu memory pids` sont
  disponibles — **pas `cpuset`**. Et un scope *système* (`systemd-run` sans
  `--user`) exige une auth polkit (refusée). Donc le **pinning CPU passe par
  `taskset`** (`sched_setaffinity`, aucun privilège), pas par cgroup cpuset.
  Validé : le process confiné affiche `Cpus_allowed_list: 0-3`.
  **Piège taskset** : pas de séparateur `--` (`taskset -c 0-3 -- cmd` échoue) →
  forme correcte `taskset -c 0-3 cmd`.

## Décision AT_SECURE : le worker C# *lance* le jeu (pas de `setcap`)

`ptrace_scope=1` autorise `process_vm_readv` si l'appelant est **ancêtre** de la
cible (ou détient `CAP_SYS_PTRACE`). Deux architectures possibles :

1. **setcap `cap_sys_ptrace+ep`** sur un lecteur quelconque → mais `setcap`
   déclenche **AT_SECURE**, et sous AT_SECURE le loader Vulkan **ignore
   `VK_DRIVER_FILES`**. Un binaire qui rend *et* porte la capability perdrait donc
   l'env LavaPipe. ❌
2. **Le worker C# (lanceur) SPAWN le jeu** → il en est l'ancêtre, donc
   `process_vm_readv` est permis **sans aucune capability**, et l'env Vulkan du
   *jeu* (process distinct, sans capability) est honoré. ✅ **C'est l'architecture
   retenue** (`GameSession` côté Bun lance la commande ; le lecteur mémoire vit
   dans l'ancêtre, cf. `IECODE.Core/Runtime/WineMemory.cs`).

Si jamais le lecteur ne pouvait pas être ancêtre, on isolerait la lecture dans un
**binaire séparé** qui ne fait PAS de Vulkan (lui peut porter `cap_sys_ptrace`),
ou on baisserait `ptrace_scope` à 0.

## Lecture mémoire Wine (côté C#)

`IECODE.Core/Runtime/WineMemory.cs` (`[SupportedOSPlatform("linux")]`) :
`process_vm_readv`/`process_vm_writev` (sans stopper la cible) + résolution de la
base d'un module via `/proc/<pid>/maps`. Wine charge le PE dans le même espace
d'adressage Linux : une VA « Windows » *est* une VA Linux réelle, donc aucune
traduction. Auto-testé (lecture d'un marqueur, `ReadStruct<int>`, write roundtrip,
résolution de base `libcoreclr.so`, parsing maps).

## Tests

```sh
bun test            # pure (cpu/vulkan) + intégration cgroup (lance `sleep`, jamais le jeu)
```

Les tests d'intégration cgroup sont **auto-skippés** si systemd-run / cgroup v2
sont absents.
