# Architecture Technique : Studio Unifié NIE & Moteur Tri-Tier

> **Spécification Technique**: NIE Studio (`@aphrody/nie-ui/studio`) & Moteur de Rendu Hybride
> **Cible Matérielle**: Windows 11 / Linux 7.4 / NVIDIA RTX 4070 (Ada `sm_89`) / WebGPU WASM

---

## 1. Vue d'Ensemble & Découplage Structurel

La suite logicielle unifie les outils de reverse-engineering, l'émulation, l'édition de sauvegarde, la manipulation de maillages 3D et le studio cinématique dans une architecture à trois étages :

```
[ Tier A : Interface Web Applicative ]
  - Stack : Next.js 15, Bun v1.4.4, tokens de design typed aphrody-nie-ui
  - Responsabilité : Sauvegardes, gestionnaire de mods, inventaire Zukan, interface FilmCraft NLE

[ Tier B : Station de Travail Native Desktop ]
  - Stack : GPUI-Kit / NSH (Rust) & eframe/wgpu (aphrody-nie-editor)
  - Responsabilité : Inspection CPK haute cadence, débogage mémoire temps réel nie.exe, désassemblage

[ Tier C : Moteur de Rendu 3D & Simulation ]
  - Stack : crates/aphrody-nie-bevy + aphrody-nie-render3d + aphrody-nie-core
  - Responsabilité : Shaders WGSL Toon Cel-Shading, chargement direct G4TX/G4MD, simulation physique 60 FPS
```

---

## 2. Ingestion et Formats Binaires Level-5

Les décodeurs natifs de [`crates/aphrody-nie-formats`](file:///C:/src/apps/rosegriffon/crates/aphrody-nie-formats) lisent sans allocation intermédiaire les formats du conteneur Criware et du moteur Level-5 :

1. **Textures G4TX** :
   - Formats supportés : `BC7` (blocs compressés 4x4) et `BGRA8` (non compressé avec inversion de canaux).
   - Intégration Bevy : Conversion directe en `bevy_image::Image` avec format de texture `TextureFormat::Rgba8UnormSrgb`.
2. **Maillages G4MD / G4MG** :
   - Extraction des sous-maillages avec sommets, normales tangentielles, canaux UV multiples.
   - Poids osseux et liaisons de squelette (`ATTRIBUTE_JOINT_WEIGHT`, `ATTRIBUTE_JOINT_INDEX`) injectés directement dans `bevy_mesh::Mesh`.
3. **Fichiers de Configuration RDBN (`cfg.bin`)** :
   - Tables de paramètres structurées : `chara_param`, `skill_config`, `growth_curve`.
   - Projection unifiée vers le schéma de base de données locale ou mémoire vive.

---

## 3. Éditeur de Sauvegarde & Cartographie Mémoire

Le runner headless [`crates/aphrody-nie-headless`](file:///C:/src/apps/rosegriffon/crates/aphrody-nie-headless) fournit l'automatisation complète de la persistance :

- **Chiffrement Stream XOR** : Calcul dynamique de clé à partir du nom d'entrée (`key_from_filename`).
- **Contrôle d'Intégrité CRC32** : Recalcul du mot de vérification `0x9DCE66C3` sur l'en-tête de conteneur.
- **Cartographie Mémoire de `nie.exe`** :
  - Section `.text` : Instructions machine x86-64 et points d'entrée du moteur.
  - Section `.rdata` : Tables de chaînes chiffrées et tables d'adresses d'importation.
  - `SAVE_MANAGER` : Instance de gestionnaire d'état de sauvegarde active (`0x142850000`).
  - `GAME_HEAP_MATCH` : Tas dynamique de simulation de match (`0x144000000`).

---

## 4. Pipeline Multimodal RAG & Ingestion Vidéo

L'ingestion automatisée de captures Steam et de séquences Hissatsu repose sur l'intégration de trois packages :

```
[ Capture .exe / DX12 ] ---> [ aphrody-nie-video ] ---> [ Master MP4 ]
                                                               |
                                            Range HTTP bytes=0-131072
                                                               v
                                                  [ @aphrody/hyperframes ]
                                                  (Localisation moov/trak)
                                                               |
                                            Échantillons d'images à la demande
                                                               v
                                                   [ FilmCraftEngine ]
                                                (Découpe razor & timeline)
                                                               |
                                            Télémétrie .jsonl + Embeddings SigLIP
                                                               v
                                                    [ var/niers.sqlite ]
                                                    (Index Vectoriel RAG)
```

1. **Extraction Sans Téléchargement (`@aphrody/hyperframes`)** :
   - `fetchByteSlice` extrait uniquement les métadonnées ISOBMFF.
   - Accès direct aux trames clés (_keyframes_) sans rapatrier le fichier vidéo entier.
2. **Télémétrie Ticks & Marqueurs (`aphrody-nie-trace`)** :
   - Enregistrement synchronisé de la caméra (matrice 4x4), position du ballon (coordonnées 3D) et identifiant d'action.
3. **Indexation Sémantique & Visuelle** :
   - Vecteurs de vision 768 dimensions générés par le démon local `ring3-agent` sur GPU RTX 4070.
   - Requêtes sémantiques instantanées exploitant `sqlite-vec`.
