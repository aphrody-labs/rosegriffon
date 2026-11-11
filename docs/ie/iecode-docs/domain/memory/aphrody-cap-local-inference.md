---
name: aphrody-cap-local-inference
description: "Cap aphrody (2026-08-21) — client + toolbox d'inference et de gestion de modeles locaux. Plan CLOS le 2026-09-07."
metadata:
  node_type: memory
  type: project
  originSessionId: 76083aee-d701-4255-9466-2f25ef8fdff1
  modified: 2026-09-07T04:05:45.256Z
---

Le 2026-08-21, Yohan a redefini le cap du projet `aphrody` : d'« Apex Autonomous
Agent » vers **client + toolbox pour l'inference et la gestion de modeles
locaux**, orientee usages **programmatiques** :

- OCR (image/PDF -> texte structure),
- transcription visuelle (screenshot/image -> description exploitable, VQA),
- transcription audio (fichier -> texte + segments horodates),
- execution de taches repetees, organisees **en tache de fond**.

**Why:** ce cap remplace le focus « agent conversationnel multi-canal » de
`docs/PLAN.md` (revision 2026-05-19). Les briques cloud (router 3-providers,
chat turn-loop) deviennent secondaires ; la valeur passe au local/offline.

**Plan CLOS le 2026-09-07** : les 7 etapes sont livrees et prouvees sur du
materiel reel (RTX 4070, CUDA 13.3) — `aphrody-models` (cycle de vie des
poids), `aphrody-infer` (ONNX Runtime + EP CUDA), `aphrody-ocr`,
`aphrody-vision`, STT sans stub (whisper.cpp **pilote**, pas lie),
`aphrody-jobs` + la commande `aphrody job`, et la surface MCP (4 outils
derriere la feature `toolbox` de `google_mcp`). Les quatre usages du cap sont
accessibles en CLI **et** en MCP. Detail :
`docs/plans/local-inference-toolbox.md`.

**How to apply:** privilegier l'inference locale sur les appels API. Les
runtimes C++ a evolution rapide (llama.cpp, whisper.cpp) sont **pilotes en
processus fils**, jamais lies — lier figerait un build dans le notre et se
heurterait au `+crt-static` MSVC. Rien n'est telecharge pendant une inference :
un modele absent rend une erreur qui cite `aphrody model pull <id>`.

L'invariant transverse a ne jamais casser : **une page sans texte est un
verdict, pas une chaine vide**. Un modele de vision decrira volontiers une
illustration ; ecrire cette description comme transcription corrompt un corpus
en silence. C'est pourquoi `aphrody_ocr` et `aphrody_describe_image` sont deux
outils MCP distincts et non un drapeau. Voir [[vlm-ocr-lessons]] et
[[corpus-databooks-defauts]].
