// Auto-generated from contract/openapi.yml + Achilléa + Inagle — DO NOT EDIT.
// Regenerate via: just contract

export const OPENAPI_VERSION = "3.2.1" as const;
export const OPENAPI_DIALECT = "https://spec.openapis.org/oas/3.2/dialect/2025-09-19" as const;
export const OPENAPI_PATH_COUNT = 57 as const;
export const OPENAPI_SCHEMA_COUNT = 235 as const;

export const MONOREPO_OPENAPI = {
  "openapi": "3.2.1",
  "$self": "https://api.rosegriffon.fr/openapi.json",
  "jsonSchemaDialect": "https://spec.openapis.org/oas/3.2/dialect/2025-09-19",
  "info": {
    "title": "Rose Griffon Monorepo Unified API",
    "version": "1.4.4",
    "summary": "Contrat OpenAPI 3.2.1 unifié de tout le monorepo (RG, Achilléa, Ranked, Azalée, Inagle, NIE, Website)",
    "description": "Spécification canonique OpenAPI 3.2.1 couvrant tous les services HTTP/REST du monorepo Rose Griffon :\n- **rg-bot Unified API** (`api.rosegriffon.fr`, port 8800)\n- **Achilléa & Ranked Arena** (`ranked.rosegriffon.fr`, port 4002)\n- **Azalée Wiki & Game Data** (`azalee.rosegriffon.fr`, port 8807)\n- **Inagle Game Data & VFS** (`inagle`)\n- **aphrody-nie-model-serve** (`cdn.rosegriffon.fr`, port 8792)\n- **rg-website Next.js API** (`rosegriffon.fr`, port 3000)\n",
    "license": {
      "name": "Apache-2.0",
      "url": "https://www.apache.org/licenses/LICENSE-2.0"
    }
  },
  "servers": [
    {
      "url": "https://api.rosegriffon.fr",
      "description": "Production Unified API (Elysia / Bun)"
    },
    {
      "url": "https://rosegriffon.fr",
      "description": "Production Website (Next.js App Router)"
    },
    {
      "url": "https://ranked.rosegriffon.fr",
      "description": "Production Ranked Lobby & Matchmaking Server"
    },
    {
      "url": "https://azalee.rosegriffon.fr",
      "description": "Production Azalée Headless Wiki Server"
    },
    {
      "url": "https://cdn.rosegriffon.fr",
      "description": "Production NIE Model & Asset Serve (Rust)"
    },
    {
      "url": "http://127.0.0.1:8800",
      "description": "Local Unified API"
    },
    {
      "url": "http://127.0.0.1:3000",
      "description": "Local Website"
    }
  ],
  "tags": [
    {
      "name": "platform",
      "summary": "Santé, découverte OpenAPI, agent configuration et tâches planifiées",
      "kind": "platform"
    },
    {
      "name": "auth",
      "summary": "Authentification Better Auth, sessions, tokens temps réel et Discord/Patreon/VRoid",
      "kind": "domain"
    },
    {
      "name": "achillea",
      "summary": "Tournois, circuits, équipes, profils, portefeuille et sanctions",
      "kind": "domain"
    },
    {
      "name": "ranked",
      "summary": "Défis, lobbies, télémetrie, saisons et litiges classés",
      "parent": "achillea",
      "kind": "resource"
    },
    {
      "name": "azalee",
      "summary": "Encyclopédie Inazuma Eleven Victory Road et bridge Azalée",
      "kind": "domain"
    },
    {
      "name": "inagle",
      "summary": "Données de jeu Inagle, BASARA, formats VFS, constantes nie.exe et sauvegardes",
      "kind": "domain"
    },
    {
      "name": "nie",
      "summary": "Serveur Rust natif de modèles 3D GLB, textures G4TX, polices, VFS et audio",
      "parent": "inagle",
      "kind": "resource"
    },
    {
      "name": "wiki",
      "summary": "Endpoints wiki communautaires exposés sur /v1/wiki",
      "parent": "azalee",
      "kind": "resource"
    },
    {
      "name": "community",
      "summary": "Équipe, événements calendrier, partenaires, streams et recrutement",
      "kind": "domain"
    },
    {
      "name": "content",
      "summary": "Articles, galerie, flux sociaux, statistiques d'émotes et recherche",
      "kind": "domain"
    },
    {
      "name": "billing",
      "summary": "Webhooks Stripe et checkout",
      "kind": "domain"
    },
    {
      "name": "website",
      "summary": "Routes API Next.js de apps/rg-website",
      "kind": "service"
    }
  ],
  "paths": {
    "/health": {
      "get": {
        "tags": [
          "platform"
        ],
        "operationId": "getPlatformHealth",
        "summary": "Vérifier la santé du service HTTP",
        "responses": {
          "200": {
            "description": "Service opérationnel",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HealthStatus"
                }
              }
            }
          }
        }
      }
    },
    "/openapi.json": {
      "get": {
        "tags": [
          "platform"
        ],
        "operationId": "getOpenApiSpec",
        "summary": "Document OpenAPI 3.2.1 canonique du monorepo",
        "responses": {
          "200": {
            "description": "Spécification OpenAPI 3.2.1 au format JSON",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object"
                }
              }
            }
          }
        }
      }
    },
    "/docs": {
      "get": {
        "tags": [
          "platform"
        ],
        "operationId": "getApiDocsUi",
        "summary": "Interface interactive Swagger / Scalar",
        "responses": {
          "200": {
            "description": "Page HTML de documentation interactive"
          }
        }
      }
    },
    "/.well-known/agent-configuration": {
      "get": {
        "tags": [
          "auth"
        ],
        "operationId": "getAgentConfiguration",
        "summary": "Métadonnées agent Better Auth",
        "responses": {
          "200": {
            "description": "Configuration agent JSON"
          }
        }
      }
    },
    "/v1/cron/{job}": {
      "post": {
        "tags": [
          "platform"
        ],
        "operationId": "runCronJob",
        "summary": "Déclencher une tâche planifiée via Bearer secret",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "job",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "attendre",
            "in": "query",
            "schema": {
              "type": "string",
              "enum": [
                "0",
                "1"
              ]
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Résultat d'exécution de la tâche"
          }
        }
      }
    },
    "/v1/discord/announce": {
      "post": {
        "tags": [
          "platform"
        ],
        "operationId": "postDiscordAnnounce",
        "summary": "Publier une annonce Discord depuis le site",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Annonce transmise"
          }
        }
      }
    },
    "/v1/discord/interactions/execute": {
      "post": {
        "tags": [
          "platform"
        ],
        "operationId": "executeDiscordInteraction",
        "summary": "Exécuter une interaction Discord transmise par aphrody-rg-server",
        "responses": {
          "200": {
            "description": "Réponse d'interaction Discord"
          }
        }
      }
    },
    "/v1/auth/realtime-token": {
      "get": {
        "tags": [
          "auth"
        ],
        "operationId": "issueRealtimeToken",
        "summary": "Émettre un JWT temps réel pour Achilléa / Ranked",
        "responses": {
          "200": {
            "description": "Jeton temps réel"
          }
        }
      }
    },
    "/v1/auth/me": {
      "get": {
        "tags": [
          "auth"
        ],
        "operationId": "getCurrentAuthSession",
        "summary": "Lire la session et le profil courant",
        "responses": {
          "200": {
            "description": "Session authentifiée"
          }
        }
      }
    },
    "/v1/auth/logout": {
      "post": {
        "tags": [
          "auth"
        ],
        "operationId": "logoutSession",
        "summary": "Fermer la session courante",
        "responses": {
          "200": {
            "description": "Déconnecté"
          }
        }
      }
    },
    "/v1/tournaments": {
      "get": {
        "tags": [
          "achillea"
        ],
        "operationId": "listV1Tournaments",
        "summary": "Lister les tournois Achilléa",
        "responses": {
          "200": {
            "description": "Liste des tournois"
          }
        }
      }
    },
    "/v1/tournaments/circuit/ranking": {
      "get": {
        "tags": [
          "achillea"
        ],
        "operationId": "getV1CircuitRanking",
        "summary": "Classement du circuit Achilléa",
        "responses": {
          "200": {
            "description": "Classement du circuit"
          }
        }
      }
    },
    "/v1/tournaments/circuit/stats": {
      "get": {
        "tags": [
          "achillea"
        ],
        "operationId": "getV1CircuitStats",
        "summary": "Statistiques globales du circuit Achilléa",
        "responses": {
          "200": {
            "description": "Statistiques du circuit"
          }
        }
      }
    },
    "/v1/tournaments/{id}/summary": {
      "get": {
        "tags": [
          "achillea"
        ],
        "operationId": "getV1TournamentSummary",
        "summary": "Résumé d'un tournoi Achilléa",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Résumé du tournoi"
          }
        }
      }
    },
    "/v1/users/me": {
      "get": {
        "tags": [
          "achillea"
        ],
        "operationId": "getAchilleaCurrentUser",
        "summary": "Profil joueur Achilléa courant",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Profil Achilléa"
          }
        }
      }
    },
    "/v1/wallet/balance": {
      "get": {
        "tags": [
          "achillea"
        ],
        "operationId": "getAchilleaWalletBalance",
        "summary": "Solde du portefeuille Achilléa",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Solde et historique récent"
          }
        }
      }
    },
    "/v1/sanctions": {
      "get": {
        "tags": [
          "achillea"
        ],
        "operationId": "listAchilleaSanctions",
        "summary": "Lister les sanctions compétitives",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Liste des sanctions"
          }
        }
      }
    },
    "/api/ranked/challenge": {
      "post": {
        "tags": [
          "ranked"
        ],
        "operationId": "createRankedChallenge",
        "summary": "Créer un défi classé",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "201": {
            "description": "Défi créé"
          }
        }
      }
    },
    "/api/ranked/challenge/{code}": {
      "get": {
        "tags": [
          "ranked"
        ],
        "operationId": "getRankedChallenge",
        "summary": "Consulter un défi classé",
        "parameters": [
          {
            "name": "code",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Détail du défi"
          }
        }
      },
      "delete": {
        "tags": [
          "ranked"
        ],
        "operationId": "cancelRankedChallenge",
        "summary": "Annuler un défi classé",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "code",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Défi annulé"
          }
        }
      }
    },
    "/api/ranked/challenge/{code}/accept": {
      "post": {
        "tags": [
          "ranked"
        ],
        "operationId": "acceptRankedChallenge",
        "summary": "Accepter un défi classé",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "parameters": [
          {
            "name": "code",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Lobby créé"
          }
        }
      }
    },
    "/api/admin/ranked/overview": {
      "get": {
        "tags": [
          "ranked"
        ],
        "operationId": "getRankedAdminOverview",
        "summary": "Vue d'ensemble des lobbies et saisons classées",
        "security": [
          {
            "bearerAuth": []
          }
        ],
        "responses": {
          "200": {
            "description": "Vue admin classée"
          }
        }
      }
    },
    "/api/characters": {
      "get": {
        "tags": [
          "azalee",
          "inagle"
        ],
        "operationId": "listAzaleeCharacters",
        "summary": "Rechercher et paginer les personnages d'IEVR",
        "parameters": [
          {
            "$ref": "#/components/parameters/SearchQ"
          },
          {
            "$ref": "#/components/parameters/Page"
          },
          {
            "$ref": "#/components/parameters/Limit"
          }
        ],
        "responses": {
          "200": {
            "description": "Catalogue paginé des personnages"
          }
        }
      }
    },
    "/api/characters/{slug}": {
      "get": {
        "tags": [
          "azalee",
          "inagle"
        ],
        "operationId": "getAzaleeCharacter",
        "summary": "Fiche détaillée d'un personnage (baseSlug, slug ou id)",
        "parameters": [
          {
            "name": "slug",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Personnage détaillé"
          },
          "404": {
            "description": "Personnage introuvable"
          }
        }
      }
    },
    "/api/skills": {
      "get": {
        "tags": [
          "azalee",
          "inagle"
        ],
        "operationId": "listAzaleeSkills",
        "summary": "Lister les techniques spéciales (Hissatsu)",
        "parameters": [
          {
            "$ref": "#/components/parameters/SearchQ"
          },
          {
            "$ref": "#/components/parameters/Page"
          },
          {
            "$ref": "#/components/parameters/Limit"
          }
        ],
        "responses": {
          "200": {
            "description": "Liste des techniques"
          }
        }
      }
    },
    "/api/skills/{id}": {
      "get": {
        "tags": [
          "azalee",
          "inagle"
        ],
        "operationId": "getAzaleeSkill",
        "summary": "Fiche technique d'un hissatsu",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Technique trouvée"
          }
        }
      }
    },
    "/api/items": {
      "get": {
        "tags": [
          "azalee"
        ],
        "operationId": "listAzaleeItems",
        "summary": "Lister les objets du jeu",
        "responses": {
          "200": {
            "description": "Liste paginée d'objets"
          }
        }
      }
    },
    "/api/teams": {
      "get": {
        "tags": [
          "azalee"
        ],
        "operationId": "listAzaleeTeams",
        "summary": "Lister les équipes d'IEVR",
        "responses": {
          "200": {
            "description": "Liste des équipes"
          }
        }
      }
    },
    "/api/passives": {
      "get": {
        "tags": [
          "azalee"
        ],
        "operationId": "listAzaleePassives",
        "summary": "Lister les passifs d'équipe et joueurs",
        "responses": {
          "200": {
            "description": "Liste des passifs"
          }
        }
      }
    },
    "/api/formations": {
      "get": {
        "tags": [
          "azalee"
        ],
        "operationId": "listAzaleeFormations",
        "summary": "Lister les formations tactiques",
        "responses": {
          "200": {
            "description": "Liste des formations"
          }
        }
      }
    },
    "/api/tactics": {
      "get": {
        "tags": [
          "azalee"
        ],
        "operationId": "listAzaleeTactics",
        "summary": "Lister les tactiques spéciales",
        "responses": {
          "200": {
            "description": "Liste des tactiques"
          }
        }
      }
    },
    "/api/cpk/search": {
      "get": {
        "tags": [
          "azalee",
          "inagle"
        ],
        "operationId": "searchCpkEntries",
        "summary": "Rechercher dans l'index CPK",
        "parameters": [
          {
            "$ref": "#/components/parameters/SearchQ"
          }
        ],
        "responses": {
          "200": {
            "description": "Entrées CPK correspondantes"
          }
        }
      }
    },
    "/api/cross/stats": {
      "get": {
        "tags": [
          "azalee"
        ],
        "operationId": "getAzaleeCrossStats",
        "summary": "Statistiques du catalogue croisé",
        "responses": {
          "200": {
            "description": "Compteurs cross-catalog"
          }
        }
      }
    },
    "/v1/inagle/health": {
      "get": {
        "tags": [
          "inagle"
        ],
        "operationId": "getInagleHealth",
        "summary": "Santé du module Inagle dans rg-api",
        "responses": {
          "200": {
            "description": "Module Inagle actif"
          }
        }
      }
    },
    "/v1/wiki/characters": {
      "get": {
        "tags": [
          "wiki"
        ],
        "operationId": "listWikiCharacters",
        "summary": "Lister les personnages via /v1/wiki",
        "responses": {
          "200": {
            "description": "Catalogue personnages"
          }
        }
      }
    },
    "/v1/community/team": {
      "get": {
        "tags": [
          "community"
        ],
        "operationId": "listCommunityTeam",
        "summary": "Membres de l'équipe Rose Griffon",
        "responses": {
          "200": {
            "description": "Liste des membres"
          }
        }
      }
    },
    "/v1/content/articles": {
      "get": {
        "tags": [
          "content"
        ],
        "operationId": "listContentArticles",
        "summary": "Articles publiés Rose Griffon",
        "responses": {
          "200": {
            "description": "Articles paginés"
          }
        }
      }
    },
    "/v1/billing/webhook": {
      "post": {
        "tags": [
          "billing"
        ],
        "operationId": "handleStripeWebhook",
        "summary": "Réception des événements webhook Stripe",
        "responses": {
          "200": {
            "description": "Événement traité"
          }
        }
      }
    },
    "/vfs/ls": {
      "get": {
        "tags": [
          "nie"
        ],
        "operationId": "listNieVfsDirectory",
        "summary": "Lister un répertoire du VFS natif IEVR",
        "parameters": [
          {
            "name": "path",
            "in": "query",
            "schema": {
              "type": "string"
            }
          },
          {
            "name": "limit",
            "in": "query",
            "schema": {
              "type": "integer"
            }
          },
          {
            "name": "offset",
            "in": "query",
            "schema": {
              "type": "integer"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Contenu du répertoire et rôle catalogué"
          }
        }
      }
    },
    "/vfs/find": {
      "get": {
        "tags": [
          "nie"
        ],
        "operationId": "findNieVfsFiles",
        "summary": "Rechercher des fichiers dans le VFS natif IEVR",
        "parameters": [
          {
            "$ref": "#/components/parameters/SearchQ"
          },
          {
            "name": "ext",
            "in": "query",
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Résultats paginés du VFS"
          }
        }
      }
    },
    "/vfs/digest": {
      "get": {
        "tags": [
          "nie"
        ],
        "operationId": "getNieVfsDigest",
        "summary": "En-tête content-addressed du manifeste VFS logique",
        "responses": {
          "200": {
            "description": "Empreinte et compteur VFS"
          }
        }
      }
    },
    "/model-full/{code}.glb": {
      "get": {
        "tags": [
          "nie"
        ],
        "operationId": "getNieFullModelGlb",
        "summary": "Servir un modèle 3D glTF/GLB complet assemblé depuis G4MD/G4MG/G4TX",
        "parameters": [
          {
            "name": "code",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Binaire glTF 2.0 (model/gltf-binary)",
            "content": {
              "model/gltf-binary": {
                "schema": {
                  "type": "string",
                  "format": "binary"
                }
              }
            }
          }
        }
      }
    },
    "/tex-info/{path}": {
      "get": {
        "tags": [
          "nie"
        ],
        "operationId": "getNieTextureInfo",
        "summary": "Catalogue JSON ou feuille CSS d'un conteneur G4TX",
        "parameters": [
          {
            "name": "path",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Métadonnées de textures"
          }
        }
      }
    },
    "/ui/text.png": {
      "get": {
        "tags": [
          "nie"
        ],
        "operationId": "renderNieGameTextPng",
        "summary": "Rendu PNG d'un texte avec la police bitmap du jeu",
        "parameters": [
          {
            "name": "t",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Image PNG rendue"
          }
        }
      }
    },
    "/api/health": {
      "get": {
        "tags": [
          "website",
          "platform"
        ],
        "operationId": "getWebsiteHealth",
        "summary": "Santé du site Next.js et connectivité PostgreSQL",
        "responses": {
          "200": {
            "description": "Site sain"
          },
          "503": {
            "description": "Base dégradée"
          }
        }
      }
    },
    "/api/openapi.json": {
      "get": {
        "tags": [
          "website",
          "platform"
        ],
        "operationId": "getWebsiteOpenApiJson",
        "summary": "Exposer le document OpenAPI 3.2.1 unifié depuis rg-website",
        "responses": {
          "200": {
            "description": "Spécification OpenAPI 3.2.1 JSON"
          }
        }
      }
    },
    "/api/recherche": {
      "get": {
        "tags": [
          "website",
          "content"
        ],
        "operationId": "searchWebsiteContent",
        "summary": "Recherche unifiée articles, personnages et pages du site",
        "parameters": [
          {
            "$ref": "#/components/parameters/SearchQ"
          }
        ],
        "responses": {
          "200": {
            "description": "Résultats de recherche"
          }
        }
      }
    },
    "/api/public/achillea/info": {
      "get": {
        "tags": [
          "website",
          "achillea"
        ],
        "operationId": "getPublicAchilleaInfo",
        "summary": "Résumé public Achilléa pour le site vitrine",
        "responses": {
          "200": {
            "description": "Informations publiques Achilléa"
          }
        }
      }
    },
    "/api/public/azalee/latest": {
      "get": {
        "tags": [
          "website",
          "azalee"
        ],
        "operationId": "getPublicAzaleeLatest",
        "summary": "Dernières fiches et statistiques publiques Azalée",
        "responses": {
          "200": {
            "description": "Aperçu public Azalée"
          }
        }
      }
    },
    "/api/characters/{id}": {
      "summary": "Get character by ID",
      "description": "Retrieves complete character profile including growth curve and skill tree.",
      "get": {
        "tags": [
          "Characters"
        ],
        "summary": "Get character by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Character identifier (e.g. c01000010)"
          }
        ],
        "responses": {
          "200": {
            "description": "Character profile",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/Character"
                }
              }
            }
          },
          "404": {
            "description": "Character not found"
          }
        }
      }
    },
    "/api/vfs/formats": {
      "summary": "List recognized binary formats",
      "description": "Returns all 28 binary formats recognized and parsed by IECODE and NIE.",
      "get": {
        "tags": [
          "VFS"
        ],
        "summary": "List supported binary formats",
        "responses": {
          "200": {
            "description": "List of format descriptors",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/VfsFormatDescriptor"
                  },
                  "example": [
                    {
                      "id": 1,
                      "magicHex": "0x58543447",
                      "magicAscii": "G4TX",
                      "extension": ".g4tx",
                      "description": "Level-5 Texture Container (main DDS BCn textures + atlas sprite subregions)",
                      "isBigEndian": false,
                      "category": "texture",
                      "encryptionSupported": false,
                      "compressionSupported": true
                    },
                    {
                      "id": 2,
                      "magicHex": "0x444D3447",
                      "magicAscii": "G4MD",
                      "extension": ".g4md",
                      "description": "Level-5 3D Model Data (meshes, bone indices, vertex buffers, materials)",
                      "isBigEndian": false,
                      "category": "model",
                      "encryptionSupported": false,
                      "compressionSupported": true
                    },
                    {
                      "id": 3,
                      "magicHex": "0x474D3447",
                      "magicAscii": "G4MG",
                      "extension": ".g4mg",
                      "description": "Level-5 Model Group (collection of submeshes and LOD levels)",
                      "isBigEndian": false,
                      "category": "model",
                      "encryptionSupported": false,
                      "compressionSupported": true
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/vfs/probe": {
      "summary": "Probe binary format by magic bytes",
      "description": "Examines header bytes and returns the matching format descriptor if known.",
      "post": {
        "tags": [
          "VFS"
        ],
        "summary": "Probe binary format",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "magicHex": {
                    "type": "string",
                    "description": "Hexadecimal magic (e.g. '0x58543447')"
                  },
                  "magicAscii": {
                    "type": "string",
                    "description": "ASCII magic header (e.g. 'G4TX')"
                  }
                }
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Identified format descriptor or null",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/VfsFormatDescriptor"
                }
              }
            }
          }
        }
      }
    },
    "/api/vfs/packs": {
      "summary": "List VFS pack rules",
      "description": "Lists all CRI CPK pack routing rules, priority orders, and decryption mechanisms.",
      "get": {
        "tags": [
          "VFS"
        ],
        "summary": "List pack rules",
        "responses": {
          "200": {
            "description": "List of pack mapping rules",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/VfsPackRule"
                  },
                  "example": [
                    {
                      "packName": "common.cpk",
                      "filenameMask": "*common*.cpk",
                      "keyDerivation": "filename-crc32",
                      "mountPriority": 100,
                      "description": "Core game database, character tables (chara_base), item configs, skill definitions, and growth curves",
                      "isCompressed": true
                    },
                    {
                      "packName": "menu.cpk",
                      "filenameMask": "*menu*.cpk",
                      "keyDerivation": "filename-crc32",
                      "mountPriority": 90,
                      "description": "UI layouts, T2B menu settings, 200_icon sprites, portrait textures, and font atlases",
                      "isCompressed": true
                    },
                    {
                      "packName": "model.cpk",
                      "filenameMask": "*model*.cpk",
                      "keyDerivation": "filename-crc32",
                      "mountPriority": 80,
                      "description": "3D player models (G4MD), team kits, stadium geometries, and animation tracks (AGI)",
                      "isCompressed": true
                    },
                    {
                      "packName": "dx11.cpk",
                      "filenameMask": "*dx11*.cpk",
                      "keyDerivation": "filename-crc32",
                      "mountPriority": 70,
                      "description": "DirectX 11 compiled shaders, material descriptors, and GPU texture streams",
                      "isCompressed": true
                    },
                    {
                      "packName": "sound_asset.cpk",
                      "filenameMask": "*sound*.cpk",
                      "keyDerivation": "filename-crc32",
                      "mountPriority": 60,
                      "description": "HCA voice lines, character dialogue, match commentary, and crowd atmosphere",
                      "isCompressed": false
                    },
                    {
                      "packName": "movie.cpk",
                      "filenameMask": "*movie*.cpk",
                      "keyDerivation": "filename-crc32",
                      "mountPriority": 50,
                      "description": "Full-motion cutscenes, anime openings, and special moves (Hissatsu) USM video sequences",
                      "isCompressed": false
                    },
                    {
                      "packName": "event.cpk",
                      "filenameMask": "*event*.cpk",
                      "keyDerivation": "filename-crc32",
                      "mountPriority": 40,
                      "description": "Story mode cutscenes, MEVBIN choreography scripts, and chapter dialogue triggers",
                      "isCompressed": true
                    },
                    {
                      "packName": "cpk_list.cfg.bin",
                      "filenameMask": "cpk_list.cfg.bin",
                      "keyDerivation": "viola-fixed",
                      "mountPriority": 1000,
                      "description": "Master VFS manifest mapping internal paths to CPK pack files. Encrypted with Viola key 0x1717E18E",
                      "isCompressed": false
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/vfs/files/{path}": {
      "summary": "Read file from VFS",
      "description": "Fetches a file by logical path, resolving through mounted CPKs or loose dump overlays.",
      "get": {
        "tags": [
          "VFS"
        ],
        "summary": "Read VFS file",
        "parameters": [
          {
            "name": "path",
            "in": "path",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Logical file path (e.g. data/common/chara/chara_base.cfg.bin)"
          }
        ],
        "responses": {
          "200": {
            "description": "File payload stream",
            "content": {
              "application/octet-stream": {}
            }
          },
          "404": {
            "description": "File not found in any mounted VFS source"
          }
        }
      }
    },
    "/api/nie/re/constants": {
      "summary": "Get nie.exe cryptographic constants",
      "description": "Returns verified cryptographic keys and polynomials reverse-engineered from nie.exe.",
      "get": {
        "tags": [
          "Reverse Engineering"
        ],
        "summary": "Get crypto constants",
        "responses": {
          "200": {
            "description": "List of verified cryptographic constants",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/NieCryptoConstant"
                  },
                  "example": [
                    {
                      "name": "VIOLA_FIXED_KEY",
                      "hexValue": "0x1717E18E",
                      "intValue": 387441038,
                      "usage": "Fixed CRI XOR encryption key for cpk_list.cfg.bin and standalone Level-5 packages (discovered by Viola).",
                      "verifiedInGameDump": true
                    },
                    {
                      "name": "LEVEL5_CRC32_POLYNOMIAL",
                      "hexValue": "0xEDB88320",
                      "intValue": 3988292384,
                      "usage": "Standard IEEE 802.3 reflected CRC32 polynomial for RDBN hash dictionaries and CPK filename key derivation.",
                      "verifiedInGameDump": true
                    },
                    {
                      "name": "CRI_ENCRYPTED_TABLE_MAGIC",
                      "hexValue": "0xF5F39E1F",
                      "intValue": 4126383647,
                      "usage": "Magic header sentinel indicating an encrypted CRI @UTF table block.",
                      "verifiedInGameDump": true
                    },
                    {
                      "name": "LIVES_SAVE_HEADER_MAGIC",
                      "hexValue": "0x9DCE66C3",
                      "intValue": 2647549635,
                      "usage": "Sentinel u32 LE placed at offset 0x00 of decrypted Lives save containers (002AB8F4-*).",
                      "verifiedInGameDump": true
                    },
                    {
                      "name": "LIVES_SAVE_CONST2",
                      "hexValue": "0x2EC3031F",
                      "intValue": 784532255,
                      "usage": "Constant u32 LE at offset 0x08 of decrypted Lives save header (bytes: 1F 03 C3 2E).",
                      "verifiedInGameDump": true
                    },
                    {
                      "name": "LIVES_BLOB_MAGIC",
                      "hexValue": "0xEEFF",
                      "intValue": 61183,
                      "usage": "Big-endian u16 sentinel starting every concatenated payload blob in Lives saves.",
                      "verifiedInGameDump": true
                    },
                    {
                      "name": "STEAM_APP_ID",
                      "hexValue": "0x2AB8F4",
                      "intValue": 2799860,
                      "usage": "Official Steam App ID for Inazuma Eleven: Victory Road (hexadecimal prefix for save files: 002AB8F4).",
                      "verifiedInGameDump": true
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/nie/re/offsets": {
      "summary": "Get critical function offsets in nie.exe",
      "description": "Returns disassembler anchors, function boundary addresses, and signatures in nie.exe.",
      "get": {
        "tags": [
          "Reverse Engineering"
        ],
        "summary": "Get function offsets",
        "responses": {
          "200": {
            "description": "List of critical function offsets",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/NieMemoryOffset"
                  },
                  "example": [
                    {
                      "symbol": "GameTickLoop",
                      "addressHex": "0x1406d5840",
                      "runtimePc": "5375875136",
                      "subsystem": "game-loop",
                      "description": "Main game tick loop orchestrating 60 Hz physics update, animation blending, and entity state synchronization.",
                      "callingConvention": "__fastcall",
                      "signature": "void __fastcall GameTickLoop(void* engineContext, float deltaTime)"
                    },
                    {
                      "symbol": "CharaControllerUpdate",
                      "addressHex": "0x1404ecd60",
                      "runtimePc": "5373873504",
                      "subsystem": "controller",
                      "description": "Player movement, kinematic resolution, ball possession calculations, and user input mapping.",
                      "callingConvention": "__fastcall",
                      "signature": "void __fastcall CharaControllerUpdate(void* playerEntity, void* inputState, float dt)"
                    },
                    {
                      "symbol": "CriFsStreamDecryptBlock",
                      "addressHex": "0x1405a1120",
                      "runtimePc": "5374611744",
                      "subsystem": "crypto",
                      "description": "Position-aware XOR stream cipher implementation decrypting 4-byte quads based on file offset.",
                      "callingConvention": "__fastcall",
                      "signature": "void __fastcall CriFsStreamDecryptBlock(uint8_t* buffer, size_t length, uint64_t fileOffset, uint32_t key)"
                    },
                    {
                      "symbol": "CriLaylaDecompressStream",
                      "addressHex": "0x1405b3890",
                      "runtimePc": "5374687376",
                      "subsystem": "vfs",
                      "description": "Reverse bitstream LZSS decompressor processing byte-by-byte from end of stream into preallocated buffer.",
                      "callingConvention": "__fastcall",
                      "signature": "int32_t __fastcall CriLaylaDecompressStream(const uint8_t* input, uint8_t* output, size_t uncompressedSize)"
                    },
                    {
                      "symbol": "RdbnTableLookup",
                      "addressHex": "0x1403c8040",
                      "runtimePc": "5372674112",
                      "subsystem": "vfs",
                      "description": "Binary search in RDBN table header resolving 32-bit CRC hashes to column offsets and row pointers.",
                      "callingConvention": "__fastcall",
                      "signature": "void* __fastcall RdbnTableLookup(const uint8_t* rdbnBuffer, uint32_t tableHash, uint32_t entryHash)"
                    },
                    {
                      "symbol": "G4txDecodeTexture",
                      "addressHex": "0x1404b2a80",
                      "runtimePc": "5373635200",
                      "subsystem": "render",
                      "description": "G4TX header parsing, DDS texture extraction, and GPU resource registration.",
                      "callingConvention": "__fastcall",
                      "signature": "void* __fastcall G4txDecodeTexture(const uint8_t* g4txData, size_t dataSize, int32_t textureIndex)"
                    },
                    {
                      "symbol": "LuaHostInit",
                      "addressHex": "0x14072f910",
                      "runtimePc": "5376243984",
                      "subsystem": "lua",
                      "description": "Initializes Lua 5.1/5.2 C host environment for UI animations, dialogue branching, and menu state machines.",
                      "callingConvention": "__fastcall",
                      "signature": "void* __fastcall LuaHostInit(void* memoryPool)"
                    },
                    {
                      "symbol": "CRand_MT19937_Next",
                      "addressHex": "0x14081c200",
                      "runtimePc": "5377212928",
                      "subsystem": "prng",
                      "description": "Deterministic Mersenne Twister MT19937 pseudorandom number generator step function.",
                      "callingConvention": "__fastcall",
                      "signature": "uint32_t __fastcall CRand_MT19937_Next(void* crandState)"
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/nie/re/rtti": {
      "summary": "Get reconstructed RTTI hierarchy",
      "description": "Returns MSVC RTTI polymorphic classes and vtable offsets identified in nie.exe.",
      "get": {
        "tags": [
          "Reverse Engineering"
        ],
        "summary": "Get RTTI classes",
        "responses": {
          "200": {
            "description": "List of reconstructed RTTI classes",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/NieRttiClass"
                  },
                  "example": [
                    {
                      "name": "Object",
                      "namespace": "Level5::Engine",
                      "vtableOffsetHex": "0x140AC4000",
                      "baseClasses": [],
                      "description": "Polymorphic base class for all engine actors, components, and resource handles."
                    },
                    {
                      "name": "CharaController",
                      "namespace": "Level5::Game",
                      "vtableOffsetHex": "0x140AC68A0",
                      "baseClasses": [
                        "Level5::Engine::Object"
                      ],
                      "description": "High-level player controller managing motion states (dash, dribble, slide tackle, shoot charge)."
                    },
                    {
                      "name": "BallPhysics",
                      "namespace": "Level5::Game",
                      "vtableOffsetHex": "0x140AC7120",
                      "baseClasses": [
                        "Level5::Engine::Object"
                      ],
                      "description": "Aerodynamic and turf friction simulation for the soccer ball, including spin and pass trajectories."
                    },
                    {
                      "name": "VfsManager",
                      "namespace": "Level5::Resource",
                      "vtableOffsetHex": "0x140AD1400",
                      "baseClasses": [
                        "Level5::Engine::Object"
                      ],
                      "description": "Global filesystem coordinator mounting CPK pack archives and routing relative logical paths."
                    },
                    {
                      "name": "CpkArchive",
                      "namespace": "Level5::Resource",
                      "vtableOffsetHex": "0x140AD2200",
                      "baseClasses": [
                        "Level5::Engine::Object"
                      ],
                      "description": "CRI Middleware CPK container handle with memory-mapped file views and decryption context."
                    },
                    {
                      "name": "RenderScene",
                      "namespace": "Level5::Graphics",
                      "vtableOffsetHex": "0x140AE0100",
                      "baseClasses": [
                        "Level5::Engine::Object"
                      ],
                      "description": "Scene graph renderer managing camera viewports, shadow cascades, and lighting buffers."
                    },
                    {
                      "name": "SkinnedMesh",
                      "namespace": "Level5::Graphics",
                      "vtableOffsetHex": "0x140AE1880",
                      "baseClasses": [
                        "Level5::Engine::Object"
                      ],
                      "description": "GPU skinning mesh processor packing 32 bones into 96 vec4 matrix registers (renderObj + 0x1D98)."
                    },
                    {
                      "name": "SoundPlayer",
                      "namespace": "CriWare::Atom",
                      "vtableOffsetHex": "0x140AF4900",
                      "baseClasses": [],
                      "description": "CRI Atom Craft sound playback service managing voice categories, BGM ducking, and 3D positional audio."
                    }
                  ]
                }
              }
            }
          }
        }
      }
    },
    "/api/saves/decrypt": {
      "summary": "Decrypt Lives save file",
      "description": "Decrypts a Level-5 Lives save container (002AB8F4-*) using CRC32 filename stream cipher.",
      "post": {
        "tags": [
          "Saves"
        ],
        "summary": "Decrypt save container",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "filename": {
                    "type": "string",
                    "description": "Save container filename (e.g. 002AB8F4-USERDATALIVE)"
                  },
                  "payloadBase64": {
                    "type": "string",
                    "description": "Base64-encoded encrypted file content"
                  }
                },
                "required": [
                  "filename",
                  "payloadBase64"
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Decrypted payload and extracted EEFF blobs",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "magic": {
                      "type": "string"
                    },
                    "blobCount": {
                      "type": "integer"
                    },
                    "unpackedBytesBase64": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "parameters": {
      "SearchQ": {
        "name": "q",
        "in": "query",
        "description": "Terme de recherche textuelle",
        "schema": {
          "type": "string"
        }
      },
      "Page": {
        "name": "page",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "default": 1
        }
      },
      "Limit": {
        "name": "limit",
        "in": "query",
        "schema": {
          "type": "integer",
          "minimum": 1,
          "maximum": 500,
          "default": 50
        }
      }
    },
    "schemas": {
      "HealthStatus": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "enum": [
              "ok",
              "degraded"
            ]
          },
          "service": {
            "type": "string"
          },
          "uptime": {
            "type": "number"
          },
          "timestamp": {
            "type": "integer"
          }
        },
        "required": [
          "status"
        ]
      },
      "AdminAuditRow": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "ts": {
            "type": "string"
          },
          "actorId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "action": {
            "type": "string"
          },
          "targetType": {
            "type": "string"
          },
          "targetId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "reason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "ts",
          "actorId",
          "action",
          "targetType",
          "targetId",
          "reason"
        ]
      },
      "AdminGuildRow": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "iconURL": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "memberCount": {
            "type": "number"
          },
          "ownerId": {
            "type": "string"
          },
          "createdAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "name",
          "iconURL",
          "memberCount",
          "ownerId",
          "createdAt"
        ]
      },
      "AdminHealthResponse": {
        "type": "object",
        "properties": {
          "bot": {
            "type": "object",
            "properties": {
              "online": {
                "type": "boolean"
              },
              "uptime": {
                "type": "number"
              },
              "username": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "guilds": {
                "type": "number"
              },
              "maintenance": {
                "type": "boolean"
              }
            },
            "required": [
              "online",
              "uptime",
              "username",
              "guilds",
              "maintenance"
            ]
          },
          "host": {},
          "pid": {},
          "latency": {}
        },
        "required": [
          "bot",
          "host",
          "pid",
          "latency"
        ]
      },
      "AdminInviteResponse": {
        "type": "object",
        "properties": {
          "url": {
            "type": "string"
          }
        },
        "required": [
          "url"
        ]
      },
      "AdminMetricsSummary": {
        "type": "object",
        "properties": {
          "counters": {
            "type": "object",
            "additionalProperties": {
              "type": "number"
            }
          },
          "rawLines": {
            "type": "number"
          }
        },
        "required": [
          "counters",
          "rawLines"
        ]
      },
      "AdminOpsOverview": {
        "type": "object",
        "properties": {
          "users": {
            "type": "object",
            "properties": {
              "total": {
                "type": "number"
              },
              "staff": {
                "type": "number"
              }
            },
            "required": [
              "total",
              "staff"
            ]
          },
          "wallet": {
            "type": "object",
            "properties": {
              "wallets": {
                "type": "number"
              },
              "totalBalance": {
                "type": "number"
              },
              "txToday": {
                "type": "number"
              }
            },
            "required": [
              "wallets",
              "totalBalance",
              "txToday"
            ]
          },
          "moderation": {
            "type": "object",
            "properties": {
              "sanctionsActive": {
                "type": "number"
              },
              "licensesActive": {
                "type": "number"
              }
            },
            "required": [
              "sanctionsActive",
              "licensesActive"
            ]
          },
          "community": {
            "type": "object",
            "properties": {
              "tournamentsOngoing": {
                "type": "number"
              },
              "clansPending": {
                "type": "number"
              },
              "orgsPending": {
                "type": "number"
              },
              "castEventsOpen": {
                "type": "number"
              }
            },
            "required": [
              "tournamentsOngoing",
              "clansPending",
              "orgsPending",
              "castEventsOpen"
            ]
          },
          "ranked": {
            "type": "object",
            "properties": {
              "activeMatches": {
                "type": "number"
              },
              "contestedMatches": {
                "type": "number"
              },
              "finishedToday": {
                "type": "number"
              },
              "matchesToday": {
                "type": "number"
              },
              "totalPlayers": {
                "type": "number"
              }
            },
            "required": [
              "activeMatches",
              "contestedMatches",
              "finishedToday",
              "matchesToday",
              "totalPlayers"
            ]
          },
          "audit24h": {
            "type": "number"
          },
          "bot": {
            "type": "object",
            "properties": {
              "online": {
                "type": "boolean"
              },
              "uptime": {
                "type": "number"
              },
              "maintenance": {
                "type": "boolean"
              },
              "guilds": {
                "type": "number"
              }
            },
            "required": [
              "online",
              "uptime",
              "maintenance",
              "guilds"
            ]
          },
          "generatedAt": {
            "type": "string"
          }
        },
        "required": [
          "users",
          "wallet",
          "moderation",
          "community",
          "ranked",
          "audit24h"
        ]
      },
      "AdminRoleUpdateResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "id": {
            "type": "string"
          },
          "role": {
            "type": "number"
          }
        },
        "required": [
          "success",
          "id",
          "role"
        ]
      },
      "AdminTransactionRow": {
        "type": "object",
        "properties": {
          "id": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "number"
              }
            ]
          },
          "type": {
            "type": "string"
          },
          "amount": {
            "type": "number"
          },
          "reason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "fromUserId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "toUserId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "createdAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "type",
          "amount",
          "reason",
          "fromUserId",
          "toUserId",
          "createdAt"
        ]
      },
      "AdminUserRow": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "username": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "displayName": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "avatar": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "role": {
            "type": "number"
          },
          "lastInteract": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "username",
          "displayName",
          "avatar",
          "role",
          "lastInteract"
        ]
      },
      "AdminWalletAdjustResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "userId": {
            "type": "string"
          },
          "balance": {
            "type": "number"
          }
        },
        "required": [
          "success",
          "userId",
          "balance"
        ]
      },
      "AdminWalletRow": {
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "balance": {
            "type": "number"
          },
          "currency": {
            "type": "string"
          }
        },
        "required": [
          "userId",
          "displayName",
          "balance",
          "currency"
        ]
      },
      "AdminWalletsResponse": {
        "type": "object",
        "properties": {
          "top": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/AdminWalletRow"
            }
          },
          "recent": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/AdminTransactionRow"
            }
          }
        },
        "required": [
          "top",
          "recent"
        ]
      },
      "ApiEnvelope": {
        "description": "Réponse enveloppée : `{ success, data?, error? }`.",
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "data": {},
          "error": {
            "type": "string"
          }
        },
        "required": [
          "success"
        ]
      },
      "BotMonitoringResponse": {
        "type": "object",
        "properties": {
          "botStatus": {
            "type": "object",
            "properties": {
              "online": {
                "type": "boolean"
              },
              "uptime": {
                "anyOf": [
                  {
                    "type": "number"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "maintenance": {
                "type": "boolean"
              }
            },
            "required": [
              "online",
              "uptime",
              "maintenance"
            ]
          },
          "host": {},
          "pid": {},
          "latency": {}
        },
        "required": [
          "botStatus",
          "host",
          "pid",
          "latency"
        ]
      },
      "BotTotalsResponse": {
        "description": "Formes du tableau de bord d'administration : ops, portefeuilles, audit,\nsanté du bot et console base de données.\n\nRéservées au staff côté API, mais décrites ici comme le reste : un contrat\nprivé reste un contrat, et c'est précisément là que la dérive silencieuse\ncoûte le plus cher (une colonne renommée casse une console d'admin sans que\npersonne ne le voie avant l'incident).",
        "type": "object",
        "properties": {
          "stats": {
            "type": "object",
            "properties": {
              "totalUsers": {
                "type": "number"
              },
              "totalGuilds": {
                "type": "number"
              },
              "totalActiveUsers": {
                "type": "number"
              },
              "totalCommands": {
                "type": "number"
              }
            },
            "required": [
              "totalUsers",
              "totalGuilds",
              "totalActiveUsers",
              "totalCommands"
            ]
          }
        },
        "required": [
          "stats"
        ]
      },
      "BracketId": {
        "description": "Identifiant d'entité bracket (`brackets-model#Id`).",
        "anyOf": [
          {
            "type": "number"
          },
          {
            "type": "string"
          }
        ]
      },
      "BracketMatchStatus": {
        "description": "Statut d'un match de bracket (`brackets-model#Status`), en valeurs numériques.",
        "type": "number",
        "enum": [
          0,
          1,
          2,
          3,
          4,
          5
        ],
        "x-enum-varnames": [
          "Locked",
          "Waiting",
          "Ready",
          "Running",
          "Completed",
          "Archived"
        ]
      },
      "BracketsStageType": {
        "description": "`brackets-model#StageType` — formats de bracket supportés par la lib.",
        "enum": [
          "round_robin",
          "single_elimination",
          "double_elimination"
        ]
      },
      "CancelTournamentResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "error": {
            "type": "string"
          },
          "notified": {
            "type": "number"
          }
        },
        "required": [
          "success"
        ]
      },
      "CastAttribution": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "slotId": {
            "type": "string"
          },
          "userId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "assignedAt": {
            "type": "string"
          },
          "assignedBy": {
            "type": "string"
          },
          "confirmedAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "slotId",
          "userId",
          "assignedAt",
          "assignedBy",
          "confirmedAt"
        ]
      },
      "CastAutoAssignResult": {
        "description": "`POST /casts/:id/auto-assign`. Générique sur l'attribution : l'API renvoie\nla forme complète, un appelant peut n'en valider qu'une projection.",
        "type": "object",
        "properties": {
          "created": {
            "type": "number"
          },
          "attributions": {
            "type": "array",
            "items": {}
          }
        },
        "required": [
          "created",
          "attributions"
        ]
      },
      "CastAvailability": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "userId": {
            "type": "string"
          },
          "status": {
            "$ref": "#/components/schemas/CastAvailabilityStatus"
          },
          "preferredRoles": {
            "anyOf": [
              {
                "type": "array",
                "items": {
                  "$ref": "#/components/schemas/CastSlotRole"
                }
              },
              {
                "type": "null"
              }
            ]
          },
          "notes": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "declaredAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "userId",
          "status",
          "preferredRoles",
          "notes",
          "declaredAt"
        ]
      },
      "CastAvailabilityStatus": {
        "type": "string",
        "enum": [
          "available",
          "maybe",
          "unavailable"
        ],
        "x-enum-varnames": [
          "Available",
          "Maybe",
          "Unavailable"
        ]
      },
      "CasterPublic": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatar": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "bio": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "twitchUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "recentCasts": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "displayName",
          "avatar",
          "bio",
          "twitchUrl",
          "recentCasts"
        ]
      },
      "CastEvent": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "kind": {
            "$ref": "#/components/schemas/CastEventKind"
          },
          "scheduledAt": {
            "type": "string"
          },
          "duration": {
            "type": "number"
          },
          "tournamentId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "status": {
            "$ref": "#/components/schemas/CastEventStatus"
          },
          "description": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "twitchUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "createdBy": {
            "type": "string"
          },
          "createdAt": {
            "type": "string"
          },
          "updatedAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "kind",
          "scheduledAt",
          "duration",
          "tournamentId",
          "status",
          "description",
          "twitchUrl",
          "createdBy",
          "createdAt",
          "updatedAt"
        ]
      },
      "CastEventDetail": {
        "type": "object",
        "properties": {
          "event": {
            "$ref": "#/components/schemas/CastEvent"
          },
          "slots": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CastSlot"
            }
          },
          "attributions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CastAttribution"
            }
          },
          "checklist": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ChecklistItem"
            }
          }
        },
        "required": [
          "event",
          "slots",
          "attributions",
          "checklist"
        ]
      },
      "CastEventFilters": {
        "type": "object",
        "properties": {
          "page": {
            "type": "number"
          },
          "pageSize": {
            "type": "number"
          },
          "status": {
            "$ref": "#/components/schemas/CastEventStatus"
          },
          "from": {
            "type": "string"
          },
          "to": {
            "type": "string"
          }
        }
      },
      "CastEventKind": {
        "description": "Nature d'un évènement à caster.",
        "type": "string",
        "enum": [
          "match",
          "tournament",
          "stream",
          "other"
        ],
        "x-enum-varnames": [
          "Match",
          "Tournament",
          "Stream",
          "Other"
        ]
      },
      "CastEventListResponse": {
        "$ref": "#/components/schemas/PagedList"
      },
      "CastEventStatus": {
        "type": "string",
        "enum": [
          "planned",
          "open_signup",
          "attributed",
          "live",
          "done",
          "cancelled"
        ],
        "x-enum-varnames": [
          "Planned",
          "OpenSignup",
          "Attributed",
          "Live",
          "Done",
          "Cancelled"
        ]
      },
      "CastSlot": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "role": {
            "$ref": "#/components/schemas/CastSlotRole"
          },
          "required": {
            "type": "boolean"
          },
          "defraymentAmount": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "defraymentCurrency": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "defraymentReason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "notes": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "role",
          "required",
          "defraymentAmount",
          "defraymentCurrency",
          "defraymentReason",
          "notes"
        ]
      },
      "CastSlotRole": {
        "description": "Poste occupé sur une diffusion.",
        "type": "string",
        "enum": [
          "caster_main",
          "caster_secondary",
          "observer",
          "producer",
          "host",
          "technical"
        ],
        "x-enum-varnames": [
          "CasterMain",
          "CasterSecondary",
          "Observer",
          "Producer",
          "Host",
          "Technical"
        ]
      },
      "CastSurveyResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "eventId": {
            "type": "string"
          },
          "poolSize": {
            "type": "number"
          }
        },
        "required": [
          "success",
          "eventId",
          "poolSize"
        ]
      },
      "ChecklistItem": {
        "description": "Ligne de checklist : un poste, son attributaire éventuel, sa confirmation.",
        "type": "object",
        "properties": {
          "slot": {
            "$ref": "#/components/schemas/CastSlot"
          },
          "attribution": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/CastAttribution"
              },
              {
                "type": "null"
              }
            ]
          },
          "casterId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "confirmed": {
            "type": "boolean"
          }
        },
        "required": [
          "slot",
          "attribution",
          "casterId",
          "confirmed"
        ]
      },
      "CircuitClanEntry": {
        "description": "Classement des clans — somme des points circuit de leurs membres actuels.",
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "shortName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          },
          "points": {
            "type": "number"
          },
          "players": {
            "type": "number"
          },
          "tournamentsPlayed": {
            "type": "number"
          },
          "wins": {
            "type": "number"
          },
          "podiums": {
            "type": "number"
          },
          "tier": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "shortName",
          "avatar",
          "points",
          "players",
          "tournamentsPlayed",
          "wins",
          "podiums",
          "tier"
        ]
      },
      "CircuitClanTag": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "shortName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "shortName",
          "avatar"
        ]
      },
      "CircuitLeaderboardEntry": {
        "description": "Classement circuit — cumul de points de circuit sur tous les tournois\nélimination terminés. Calcul : `@rosegriffon/achillea-core/tournaments`.",
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "username": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          },
          "clan": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/CircuitClanTag"
              },
              {
                "type": "null"
              }
            ]
          },
          "tournamentsPlayed": {
            "type": "number"
          },
          "points": {
            "type": "number"
          },
          "tournaments": {
            "type": "number"
          },
          "wins": {
            "type": "number"
          },
          "podiums": {
            "type": "number"
          },
          "top4": {
            "type": "number"
          },
          "top8": {
            "type": "number"
          },
          "bestRank": {
            "type": "number"
          },
          "bestRankLabel": {
            "type": "string"
          },
          "tier": {
            "type": "string",
            "description": "Palier circuit — mêmes clés que le ranked (Fer → Légendaire)."
          }
        },
        "required": [
          "userId",
          "displayName",
          "username",
          "avatar",
          "clan",
          "tournamentsPlayed",
          "points",
          "tournaments",
          "wins",
          "podiums",
          "top4",
          "top8",
          "bestRank",
          "bestRankLabel",
          "tier"
        ]
      },
      "CircuitPodiumEntry": {
        "type": "object",
        "properties": {
          "rank": {
            "type": "number"
          },
          "rankLabel": {
            "type": "string"
          },
          "userId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          }
        },
        "required": [
          "rank",
          "rankLabel",
          "userId",
          "displayName",
          "avatar"
        ]
      },
      "CircuitRanking": {
        "type": "object",
        "properties": {
          "leaderboard": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CircuitLeaderboardEntry"
            }
          },
          "tournaments": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CircuitTournamentSummary"
            }
          },
          "clanRanking": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CircuitClanEntry"
            }
          }
        },
        "required": [
          "leaderboard",
          "tournaments",
          "clanRanking"
        ]
      },
      "CircuitTournamentSummary": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "size": {
            "type": "number"
          },
          "grandFinalAt": {
            "type": "string"
          },
          "podium": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CircuitPodiumEntry"
            }
          },
          "standingsStatus": {
            "enum": [
              "resolved",
              "unresolved"
            ]
          }
        },
        "required": [
          "id",
          "name",
          "size",
          "grandFinalAt",
          "podium",
          "standingsStatus"
        ]
      },
      "Clan": {
        "description": "Forme historique dénormalisée (snake_case) encore servie par quelques vues.\nConservée pour compatibilité ; toute nouvelle route doit renvoyer `ClanDTO`.",
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "logo": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "shortName": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "captain": {
            "type": "string"
          },
          "founders": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "x_url": {
            "type": "string"
          },
          "instagram_url": {
            "type": "string"
          },
          "tiktok_url": {
            "type": "string"
          },
          "fame": {
            "type": "number"
          },
          "xp": {
            "type": "number"
          },
          "rank": {
            "$ref": "#/components/schemas/Rank"
          },
          "created_at": {
            "type": "string",
            "format": "date-time"
          },
          "isPro": {
            "type": "boolean"
          },
          "isRecruiting": {
            "type": "boolean"
          },
          "autoRecruit": {
            "type": "boolean"
          },
          "langue": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "logo",
          "name",
          "shortName",
          "description",
          "captain",
          "founders",
          "fame",
          "xp",
          "created_at",
          "isPro",
          "isRecruiting",
          "autoRecruit"
        ]
      },
      "ClanApplicationDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "user": {
            "$ref": "#/components/schemas/UserDTO"
          },
          "clan": {
            "$ref": "#/components/schemas/ClanDTO"
          },
          "distinctions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ClanMemberDistinction"
            }
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "user",
          "clan",
          "distinctions",
          "createdAt",
          "updatedAt"
        ]
      },
      "ClanApplicationResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "error": {
            "type": "string"
          },
          "autojoin": {
            "type": "boolean",
            "description": "`true` quand le clan accepte automatiquement les candidatures."
          }
        },
        "required": [
          "success"
        ]
      },
      "ClanDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "founders": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Identifiants Discord des fondateurs.\n\nL'API en renvoie un TABLEAU. Le contrat disait `string`, donc la\nvalidation rejetait chaque clan : les 42 clans existaient, l'API les\nservait, et la page affichait « 0 clan trouvé »."
          },
          "name": {
            "type": "string"
          },
          "shortenedName": {
            "type": "string"
          },
          "normalizedShortName": {
            "type": "string"
          },
          "clanAvatarUrl": {
            "type": "string"
          },
          "clanBiography": {
            "type": "string"
          },
          "fame": {
            "type": "number",
            "description": "Absent de la charge utile de `GET /clans` : optionnel."
          },
          "xUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "instagramUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "tiktokUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "isRecruiting": {
            "type": "boolean"
          },
          "isInactive": {
            "type": "boolean"
          },
          "isHidden": {
            "type": "boolean"
          },
          "isDisbanded": {
            "type": "boolean"
          },
          "autoAcceptMembers": {
            "type": "boolean"
          },
          "state": {
            "$ref": "#/components/schemas/ClanState"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "languages": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "origin": {
            "type": "string"
          },
          "experience": {
            "type": "object",
            "properties": {
              "currentLevel": {
                "type": "number"
              },
              "totalXp": {
                "type": "number"
              }
            },
            "required": [
              "currentLevel",
              "totalXp"
            ]
          },
          "membersCount": {
            "type": "number"
          },
          "president": {
            "$ref": "#/components/schemas/UserDTO"
          }
        },
        "required": [
          "id",
          "founders",
          "name",
          "shortenedName",
          "normalizedShortName",
          "clanAvatarUrl",
          "clanBiography",
          "isRecruiting",
          "isInactive",
          "isHidden",
          "isDisbanded",
          "autoAcceptMembers",
          "state",
          "createdAt",
          "languages",
          "origin",
          "experience",
          "membersCount",
          "president"
        ]
      },
      "ClanInviteDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "user": {
            "$ref": "#/components/schemas/UserDTO"
          },
          "clan": {
            "$ref": "#/components/schemas/ClanDTO"
          },
          "inviter": {
            "$ref": "#/components/schemas/ClanMemberDTO"
          },
          "threadId": {
            "type": "string"
          },
          "distinctions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ClanMemberDistinction"
            }
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "lastNotifiedAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "user",
          "clan",
          "inviter",
          "distinctions",
          "createdAt",
          "updatedAt",
          "lastNotifiedAt"
        ]
      },
      "ClanMemberDistinction": {
        "type": "string",
        "enum": [
          "Joueur",
          "Staff",
          "Artiste",
          "Créateur de contenu"
        ],
        "x-enum-varnames": [
          "Player",
          "Staff",
          "Artist",
          "ContentCreator"
        ]
      },
      "ClanMemberDTO": {
        "type": "object",
        "properties": {
          "clanRole": {
            "$ref": "#/components/schemas/ClanMemberRole",
            "description": "Rôle du membre dans le clan (Trial, Member, SubCaptain, Captain)."
          },
          "distinctions": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "Distinctions brutes telles que stockées (`['Staff', 'Player']`)."
          },
          "clanFameContributed": {
            "type": "number"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "user": {
            "$ref": "#/components/schemas/UserDTO"
          }
        },
        "required": [
          "clanRole",
          "distinctions",
          "clanFameContributed",
          "createdAt",
          "updatedAt",
          "user"
        ]
      },
      "ClanMemberLimits": {
        "type": "object",
        "properties": {
          "playerLimit": {
            "type": "number"
          },
          "staffLimit": {
            "type": "number"
          }
        },
        "required": [
          "playerLimit",
          "staffLimit"
        ]
      },
      "ClanMemberRole": {
        "type": "number",
        "enum": [
          0,
          1,
          2,
          3
        ],
        "x-enum-varnames": [
          "Trial",
          "Member",
          "SubCaptain",
          "Captain"
        ]
      },
      "ClanRoleResponse": {
        "description": "`GET /clans/role` — `-1` quand l'appelant n'est dans aucun clan.",
        "type": "object",
        "properties": {
          "role": {
            "type": "number"
          }
        },
        "required": [
          "role"
        ]
      },
      "ClanState": {
        "type": "number",
        "enum": [
          0,
          1,
          2
        ],
        "x-enum-varnames": [
          "Creating",
          "PendingReview",
          "Approved"
        ]
      },
      "CloseTournamentResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "error": {
            "type": "string"
          },
          "openLobbies": {
            "type": "number"
          }
        },
        "required": [
          "success"
        ]
      },
      "Column": {
        "description": "Descripteur de colonne — partagé par toutes les tables, quel que soit l'UI.",
        "type": "object",
        "properties": {
          "field": {
            "type": "string"
          },
          "header": {
            "type": "string"
          }
        },
        "required": [
          "field",
          "header"
        ]
      },
      "CommandUsageRow": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string"
          },
          "slashCommands": {
            "type": "number"
          },
          "simpleCommands": {
            "type": "number"
          },
          "contextMenus": {
            "type": "number"
          }
        },
        "required": [
          "date",
          "slashCommands",
          "simpleCommands",
          "contextMenus"
        ]
      },
      "CompetitionStats": {
        "description": "Stats agrégées d'un mode de compétition (interclans / tournois).",
        "type": "object",
        "properties": {
          "total": {
            "type": "number",
            "description": "Nombre d'événements distincts (tournois / interclans) auxquels le joueur a participé."
          },
          "wins": {
            "type": "number",
            "description": "Victoires d'équipe / de clan (contrib)."
          },
          "losses": {
            "type": "number",
            "description": "Défaites d'équipe / de clan (contrib)."
          },
          "draws": {
            "type": "number",
            "description": "Nuls d'équipe (si applicable)."
          },
          "goalsScoredAvg": {
            "type": "number"
          },
          "goalsReceivedAvg": {
            "type": "number"
          },
          "personalTotal": {
            "type": "number",
            "description": "Matchs individuels joués."
          },
          "personalWins": {
            "type": "number"
          },
          "personalLosses": {
            "type": "number"
          },
          "personalDraws": {
            "type": "number"
          }
        },
        "required": [
          "total",
          "wins",
          "losses",
          "draws",
          "goalsScoredAvg",
          "goalsReceivedAvg",
          "personalTotal",
          "personalWins",
          "personalLosses",
          "personalDraws"
        ]
      },
      "Country": {
        "description": "Pays / langue d'origine d'un clan ou d'une organisation.\n\nLa table de référence elle-même vit dans\n`@rosegriffon/achillea-core/reference` : c'est une donnée, pas un contrat.",
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "description": "Code ISO 639-1 en minuscules (`fr`, `en`, …)."
          },
          "language": {
            "type": "string",
            "description": "Libellé de la langue en français (`Français`)."
          },
          "flag": {
            "type": "string",
            "description": "Chemin du drapeau, relatif aux assets du front."
          },
          "name": {
            "type": "string",
            "description": "Nom du pays en français (`France`)."
          }
        },
        "required": [
          "code",
          "language",
          "flag",
          "name"
        ]
      },
      "CreateCastEventPayload": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "kind": {
            "$ref": "#/components/schemas/CastEventKind"
          },
          "scheduledAt": {
            "type": "string"
          },
          "duration": {
            "type": "number"
          },
          "tournamentId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "twitchUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "description": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "slots": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "role": {
                  "$ref": "#/components/schemas/CastSlotRole"
                },
                "required": {
                  "type": "boolean"
                }
              },
              "required": [
                "role"
              ]
            }
          }
        },
        "required": [
          "name",
          "kind",
          "scheduledAt",
          "slots"
        ]
      },
      "CreatePlayerNotePayload": {
        "type": "object",
        "properties": {
          "targetId": {
            "type": "string"
          },
          "tournamentId": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "category": {
            "$ref": "#/components/schemas/PlayerNoteCategory"
          },
          "severity": {
            "$ref": "#/components/schemas/PlayerNoteSeverity"
          },
          "content": {
            "type": "string"
          }
        },
        "required": [
          "targetId",
          "content"
        ]
      },
      "CreateSanctionPayload": {
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          },
          "guildId": {
            "type": "string"
          },
          "type": {
            "$ref": "#/components/schemas/SanctionType"
          },
          "reason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "durationSec": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "evidence": {
            "anyOf": [
              {
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": {}
                }
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "userId",
          "guildId",
          "type"
        ]
      },
      "DailyCountRow": {
        "type": "object",
        "properties": {
          "date": {
            "type": "string"
          },
          "count": {
            "type": "number"
          }
        },
        "required": [
          "date",
          "count"
        ]
      },
      "DatabaseBackupResult": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string"
          },
          "data": {
            "type": "object",
            "properties": {
              "snapshotName": {
                "type": "string"
              }
            },
            "required": [
              "snapshotName"
            ]
          }
        },
        "required": [
          "message"
        ]
      },
      "DbColumn": {
        "description": "Métadonnée de colonne SQL — voisine de `Column`, mais côté base.",
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "dataType": {
            "type": "string"
          },
          "nullable": {
            "type": "boolean"
          },
          "default": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "isPrimaryKey": {
            "type": "boolean"
          }
        },
        "required": [
          "name",
          "dataType",
          "nullable",
          "default",
          "isPrimaryKey"
        ]
      },
      "DbMutationResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "row": {
            "anyOf": [
              {
                "type": "object",
                "additionalProperties": {}
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "success"
        ]
      },
      "DbQueryResult": {
        "type": "object",
        "properties": {
          "data": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": {}
            }
          },
          "rowCount": {
            "type": "number"
          },
          "durationMs": {
            "type": "number"
          }
        },
        "required": [
          "data",
          "rowCount",
          "durationMs"
        ]
      },
      "DbRowsPage": {
        "type": "object",
        "properties": {
          "data": {
            "type": "array",
            "items": {
              "type": "object",
              "additionalProperties": {}
            }
          },
          "columns": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/DbColumn"
            }
          },
          "meta": {
            "$ref": "#/components/schemas/PageMeta"
          }
        },
        "required": [
          "data",
          "columns",
          "meta"
        ]
      },
      "DbTableRow": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "estimatedRows": {
            "type": "number"
          },
          "protected": {
            "type": "boolean"
          }
        },
        "required": [
          "name",
          "estimatedRows",
          "protected"
        ]
      },
      "DisqualifyResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "error": {
            "type": "string"
          },
          "forfeitedLobbies": {
            "type": "number"
          },
          "promoted": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "success"
        ]
      },
      "EnrichedUserDTO": {
        "anyOf": [
          {
            "$ref": "#/components/schemas/UserDTO"
          },
          {
            "type": "object",
            "properties": {
              "clan": {
                "$ref": "#/components/schemas/UserClanSummary"
              },
              "interclans": {
                "$ref": "#/components/schemas/CompetitionStats"
              },
              "tournaments": {
                "$ref": "#/components/schemas/CompetitionStats",
                "description": "Stats de matchs de tournoi (brackets / swiss)."
              },
              "ranked": {
                "type": "object",
                "properties": {
                  "solo": {
                    "$ref": "#/components/schemas/RankedModeStats"
                  },
                  "duo": {
                    "$ref": "#/components/schemas/RankedModeStats"
                  }
                },
                "required": [
                  "solo",
                  "duo"
                ]
              },
              "bio": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "null"
                  }
                ],
                "description": "Éditable par le titulaire du profil (PUT /users/me/profile)."
              },
              "twitchUrl": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "interclans",
              "tournaments",
              "ranked",
              "bio",
              "twitchUrl"
            ]
          }
        ]
      },
      "EntityRef": {
        "description": "Relation sérialisée par l'ORM : soit l'identifiant seul, soit l'entité\npeuplée, selon que la requête a chargé la relation ou non. Un client doit\ngérer les deux cas — d'où ce type plutôt qu'un objet supposé toujours présent.",
        "anyOf": [
          {
            "type": "number"
          },
          {}
        ]
      },
      "EventEntity": {
        "description": "Racine commune à tout évènement compétitif (tournoi, interclan, ranked).",
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "type": {
            "$ref": "#/components/schemas/EventTypeEnum"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "name",
          "description",
          "type",
          "createdAt",
          "updatedAt"
        ]
      },
      "EventTypeEnum": {
        "type": "string",
        "enum": [
          "TOURNAMENT",
          "INTERCLAN",
          "RANKED"
        ],
        "x-enum-varnames": [
          "TOURNAMENT",
          "INTERCLAN",
          "RANKED"
        ]
      },
      "FormMode": {
        "description": "Mode d'un formulaire de validation (création / revue / édition).",
        "type": "number",
        "enum": [
          0,
          1,
          2
        ],
        "x-enum-varnames": [
          "Create",
          "Validate",
          "Edit"
        ]
      },
      "GameScoreDTO": {
        "type": "object",
        "properties": {
          "lobbyId": {
            "type": "number"
          },
          "gameNumber": {
            "type": "number"
          },
          "score1": {
            "type": "number"
          },
          "score2": {
            "type": "number"
          }
        },
        "required": [
          "lobbyId",
          "gameNumber",
          "score1",
          "score2"
        ]
      },
      "GameValidatorDTO": {
        "type": "object",
        "properties": {
          "lobbyId": {
            "type": "number"
          },
          "lobbyMatchId": {
            "type": "number"
          }
        },
        "required": [
          "lobbyId",
          "lobbyMatchId"
        ]
      },
      "GrandFinalType": {
        "description": "`brackets-model#GrandFinalType`.",
        "enum": [
          "none",
          "simple",
          "double"
        ]
      },
      "HealthCheckResponse": {
        "type": "object",
        "properties": {
          "online": {
            "type": "boolean"
          },
          "uptime": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "lastStartup": {}
        },
        "required": [
          "online",
          "uptime"
        ]
      },
      "ImageGenerationResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "error": {
            "type": "string"
          },
          "path": {
            "type": "string"
          }
        },
        "required": [
          "success"
        ]
      },
      "InterclanState": {
        "type": "number",
        "enum": [
          0,
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8
        ],
        "x-enum-varnames": [
          "PENDING_APPROVAL",
          "APPROVED",
          "DENIED",
          "READY",
          "ONGOING",
          "FINISHED",
          "CANCELED",
          "RESULT_OK",
          "RESULT_NOK"
        ]
      },
      "LeaderboardEntry": {
        "type": "object",
        "properties": {
          "rank": {
            "type": "number"
          },
          "userId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          },
          "elo": {
            "type": "number"
          },
          "peakRating": {
            "type": "number"
          },
          "gamesPlayed": {
            "type": "number"
          }
        },
        "required": [
          "rank",
          "userId",
          "displayName",
          "avatar",
          "elo",
          "peakRating",
          "gamesPlayed"
        ]
      },
      "LeaderboardPage": {
        "type": "object",
        "properties": {
          "entries": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/LeaderboardEntry"
            }
          },
          "total": {
            "type": "number"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          }
        },
        "required": [
          "entries",
          "total",
          "mode"
        ]
      },
      "LeagueListResponse": {
        "type": "object",
        "properties": {
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/LeagueSummary"
            }
          }
        },
        "required": [
          "items"
        ]
      },
      "LeagueMatchRow": {
        "type": "object",
        "properties": {
          "homeId": {
            "type": "string"
          },
          "awayId": {
            "type": "string"
          },
          "homeScore": {
            "type": "number"
          },
          "awayScore": {
            "type": "number"
          },
          "matchday": {
            "type": "number"
          },
          "overtime": {
            "type": "boolean"
          },
          "winnerId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "homeId",
          "awayId",
          "homeScore",
          "awayScore",
          "matchday"
        ]
      },
      "LeaguePointsConfig": {
        "type": "object",
        "properties": {
          "win": {
            "type": "number",
            "description": "Graphie servie par l'API."
          },
          "draw": {
            "type": "number"
          },
          "loss": {
            "type": "number"
          },
          "winRegulation": {
            "type": "number",
            "description": "Graphie historique du contrat, conservée pour les appelants existants."
          },
          "lossRegulation": {
            "type": "number"
          },
          "winOvertime": {
            "type": "number"
          },
          "lossOvertime": {
            "type": "number"
          }
        }
      },
      "LeagueSeasonPayload": {
        "type": "object",
        "properties": {
          "meta": {
            "$ref": "#/components/schemas/LeagueSummary"
          },
          "format": {
            "type": "object",
            "additionalProperties": {}
          },
          "teams": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/LeagueTeam"
            }
          },
          "pointsConfig": {
            "$ref": "#/components/schemas/LeaguePointsConfig"
          },
          "standings": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/LeagueStandingRow"
            }
          },
          "results": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/LeagueMatchRow"
            }
          },
          "playoffs": {},
          "schedule": {},
          "details": {}
        },
        "required": [
          "meta",
          "format",
          "teams",
          "pointsConfig",
          "standings",
          "results",
          "playoffs"
        ]
      },
      "LeagueStandingRow": {
        "type": "object",
        "properties": {
          "teamId": {
            "type": "string"
          },
          "rank": {
            "type": "number"
          },
          "played": {
            "type": "number"
          },
          "wins": {
            "type": "number"
          },
          "draws": {
            "type": "number"
          },
          "losses": {
            "type": "number"
          },
          "winsOt": {
            "type": "number"
          },
          "lossesOt": {
            "type": "number"
          },
          "points": {
            "type": "number"
          },
          "mapDiff": {
            "type": "number"
          },
          "mapsFor": {
            "type": "number"
          },
          "mapsAgainst": {
            "type": "number"
          }
        },
        "required": [
          "teamId",
          "rank",
          "played",
          "wins",
          "draws",
          "losses",
          "winsOt",
          "lossesOt",
          "points",
          "mapDiff",
          "mapsFor",
          "mapsAgainst"
        ]
      },
      "LeagueSummary": {
        "description": "Formes de championnat exposées par l'API.\n\nLe calcul (classement, points, calendrier) vit dans\n`@rosegriffon/achillea-core/league` ; seules les formes échangées sont ici,\npour qu'un client n'ait pas à dépendre de la logique métier pour lire une\nréponse.",
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "season": {
            "type": "string"
          },
          "format": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "champion": {
            "type": "string"
          },
          "teamCount": {
            "type": "number"
          },
          "matchdays": {
            "type": "number"
          },
          "aliases": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "id",
          "name",
          "season",
          "format",
          "description",
          "teamCount",
          "matchdays",
          "aliases"
        ]
      },
      "LeagueTeam": {
        "type": "object",
        "properties": {
          "tag": {
            "type": "string"
          },
          "name": {
            "type": "string"
          }
        },
        "required": [
          "tag",
          "name"
        ]
      },
      "License": {
        "description": "Licence joueur — un titulaire = un userId Discord, une licence active à la\nfois, vérifiable publiquement via un QR code.",
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "userId": {
            "type": "string"
          },
          "licenseNumber": {
            "type": "string"
          },
          "issuedAt": {
            "type": "string"
          },
          "validUntil": {
            "type": "string"
          },
          "status": {
            "$ref": "#/components/schemas/LicenseStatus"
          },
          "pdfUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Nullable until the printable licence PDF has been generated."
          },
          "createdAt": {
            "type": "string"
          },
          "updatedAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "userId",
          "licenseNumber",
          "issuedAt",
          "validUntil",
          "status",
          "pdfUrl",
          "createdAt",
          "updatedAt"
        ]
      },
      "LicenseHolderResponse": {
        "description": "`GET /licenses/me` — `null` tant qu'aucune licence n'a été émise.",
        "type": "object",
        "properties": {
          "license": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/License"
              },
              {
                "type": "null"
              }
            ]
          },
          "verificationToken": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Owner-only bearer token used to share the public verification URL."
          }
        },
        "required": [
          "license",
          "verificationToken"
        ]
      },
      "LicenseStatus": {
        "description": "État d'une licence joueur.",
        "type": "string",
        "enum": [
          "Active",
          "Revoked",
          "Expired"
        ],
        "x-enum-varnames": [
          "Active",
          "Revoked",
          "Expired"
        ]
      },
      "LicenseVerifyReason": {
        "description": "Motif d'invalidité renvoyé par la vérification publique.",
        "enum": [
          "not_found",
          "revoked",
          "expired"
        ]
      },
      "LicenseVerifyResult": {
        "description": "Résultat de `GET /licenses/verify/{qr}` (endpoint PUBLIC, sans auth).",
        "type": "object",
        "properties": {
          "valid": {
            "type": "boolean"
          },
          "reason": {
            "$ref": "#/components/schemas/LicenseVerifyReason"
          },
          "licenseNumber": {
            "type": "string"
          },
          "validUntil": {
            "type": "string"
          },
          "holder": {
            "type": "object",
            "properties": {
              "displayName": {
                "type": "string"
              },
              "avatar": {
                "anyOf": [
                  {
                    "type": "string"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "displayName",
              "avatar"
            ]
          }
        },
        "required": [
          "valid"
        ]
      },
      "LobbyDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "state": {
            "$ref": "#/components/schemas/LobbyState"
          },
          "bracketMatchId": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "lobbyUsers": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/LobbyUserDTO"
            }
          },
          "lobbyMatches": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/LobbyMatchDTO"
            }
          },
          "hostUser": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/LobbyUserDTO"
              },
              {
                "type": "null"
              }
            ]
          },
          "matchFormat": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/MatchFormat"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "mode",
          "state",
          "lobbyUsers",
          "lobbyMatches",
          "hostUser"
        ]
      },
      "LobbyMatchDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "gameNumber": {
            "type": "number"
          },
          "scoreTeam1": {
            "type": "number"
          },
          "scoreTeam2": {
            "type": "number"
          },
          "team1Validated": {
            "type": "boolean"
          },
          "team2Validated": {
            "type": "boolean"
          },
          "adminValidated": {
            "type": "boolean"
          }
        },
        "required": [
          "id",
          "gameNumber",
          "scoreTeam1",
          "scoreTeam2",
          "team1Validated",
          "team2Validated",
          "adminValidated"
        ]
      },
      "LobbyState": {
        "type": "string",
        "enum": [
          "Fresh",
          "Ongoing",
          "Pending validation",
          "Contested",
          "Finished",
          "Canceled",
          "Forfeited"
        ],
        "x-enum-varnames": [
          "FRESH",
          "ONGOING",
          "PENDING_VALIDATION",
          "CONTESTED",
          "FINISHED",
          "CANCELED",
          "FORFEITED"
        ]
      },
      "LobbyUserDataDTO": {
        "type": "object",
        "properties": {
          "displayName": {
            "type": "string"
          },
          "id": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          }
        },
        "required": [
          "displayName",
          "id",
          "avatar"
        ]
      },
      "LobbyUserDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "user": {
            "$ref": "#/components/schemas/LobbyUserDataDTO"
          },
          "team": {
            "$ref": "#/components/schemas/TeamSide"
          },
          "forfeit": {
            "type": "boolean"
          },
          "state": {
            "$ref": "#/components/schemas/LobbyUserState"
          }
        },
        "required": [
          "id",
          "user",
          "team",
          "forfeit",
          "state"
        ]
      },
      "LobbyUserState": {
        "type": "string",
        "enum": [
          "Pending",
          "Ready",
          "Afk",
          "Ongoing",
          "Finished",
          "Repooled"
        ],
        "x-enum-varnames": [
          "PENDING",
          "READY",
          "AFK",
          "ONGOING",
          "FINISHED",
          "REPOOLED"
        ]
      },
      "MaintenanceResponse": {
        "type": "object",
        "properties": {
          "maintenance": {
            "type": "boolean"
          }
        },
        "required": [
          "maintenance"
        ]
      },
      "MatchFormat": {
        "type": "string",
        "enum": [
          "bo1",
          "bo3",
          "bo5",
          "double_leg",
          "custom"
        ],
        "x-enum-varnames": [
          "BO1",
          "BO3",
          "BO5",
          "DOUBLE_LEG",
          "CUSTOM"
        ]
      },
      "MatchMode": {
        "type": "number",
        "enum": [
          2,
          4
        ],
        "x-enum-varnames": [
          "ONE_VS_ONE",
          "TWO_VS_TWO"
        ]
      },
      "MatchResult": {
        "enum": [
          "win",
          "loss",
          "draw",
          "forfeit"
        ]
      },
      "MatchRoomStatus": {
        "enum": [
          "waiting",
          "playing",
          "scoring",
          "disputed",
          "finished"
        ]
      },
      "ModerationSyncResult": {
        "type": "object",
        "properties": {
          "ok": {
            "type": "boolean"
          },
          "sanctionId": {
            "type": "string"
          }
        },
        "required": [
          "ok",
          "sanctionId"
        ]
      },
      "NewClanPayload": {
        "description": "Création d'un clan (POST /clans/create, API Achilléa historique).",
        "type": "object",
        "properties": {
          "founders": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string"
                }
              },
              "required": [
                "id"
              ]
            }
          },
          "logo": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "normalizedName": {
            "type": "string"
          },
          "shortName": {
            "type": "string"
          },
          "normalizedShortName": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "twitter": {
            "type": "string"
          },
          "instagram": {
            "type": "string"
          },
          "tiktok": {
            "type": "string"
          },
          "origin": {
            "$ref": "#/components/schemas/Country"
          },
          "languages": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Country"
            }
          }
        },
        "required": [
          "founders",
          "logo",
          "name",
          "normalizedName",
          "shortName",
          "normalizedShortName",
          "description"
        ]
      },
      "NewClanResponse": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "error": {
            "type": "string"
          },
          "clanId": {
            "type": "number"
          },
          "conflict": {
            "type": "string",
            "description": "Renseigné sur un conflit de nom (409)."
          }
        },
        "required": [
          "success"
        ]
      },
      "NewTournamentDTO": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "series": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/TournamentSeries"
              },
              {
                "type": "null"
              }
            ]
          },
          "organization": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/OrganizationDTO"
              },
              {
                "type": "number"
              }
            ]
          },
          "managers": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/UserDTO"
            }
          },
          "startsAt": {
            "type": "string",
            "format": "date-time"
          },
          "grandFinalAt": {
            "type": "string",
            "format": "date-time"
          },
          "tournamentType": {
            "$ref": "#/components/schemas/StageType"
          },
          "participantsNumber": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "seedOrdering": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/SeedOrdering"
              },
              {
                "type": "null"
              }
            ]
          },
          "matchFormat": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/MatchFormat"
              },
              {
                "type": "null"
              }
            ]
          },
          "customFormatChildCount": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "groupStageEnabled": {
            "type": "boolean"
          },
          "groupStageType": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/StageType"
              },
              {
                "type": "null"
              }
            ]
          },
          "affiche": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "logo": {
            "type": "string"
          },
          "ruleset": {
            "type": "string"
          },
          "planning": {
            "type": "string"
          },
          "registrationOpensAt": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Planning automatisé — facultatif : sans dates, le tournoi se conduit à la main."
          },
          "registrationClosesAt": {
            "anyOf": [
              {
                "type": "string",
                "format": "date-time"
              },
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "autoStart": {
            "type": "boolean"
          },
          "discordRoleEnabled": {
            "type": "boolean",
            "description": "Rôle Discord distribué aux inscrits."
          },
          "scoreReportPolicy": {
            "$ref": "#/components/schemas/ScoreReportPolicy",
            "description": "Qui saisit les scores des matchs (défaut : les joueurs)."
          },
          "bypassRules": {
            "type": "boolean",
            "description": "Dérogation aux règles de publication — SuperAdmin uniquement, côté API."
          }
        },
        "required": [
          "name",
          "description",
          "organization",
          "startsAt",
          "grandFinalAt",
          "tournamentType",
          "groupStageEnabled",
          "logo",
          "ruleset",
          "planning"
        ]
      },
      "NotificationCategory": {
        "type": "number",
        "enum": [
          0,
          1,
          2,
          3
        ],
        "x-enum-varnames": [
          "USER",
          "CLAN",
          "GLOBAL",
          "ORGANIZATION"
        ]
      },
      "NotificationModel": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "title": {
            "type": "string"
          },
          "message": {
            "type": "string"
          },
          "type": {
            "$ref": "#/components/schemas/NotificationType"
          },
          "category": {
            "$ref": "#/components/schemas/NotificationCategory"
          },
          "payload": {
            "anyOf": [
              {
                "type": "object",
                "additionalProperties": {}
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "title",
          "message",
          "type",
          "category",
          "payload"
        ]
      },
      "NotificationType": {
        "type": "number",
        "enum": [
          0,
          1,
          2,
          3,
          4,
          5,
          6,
          7,
          8,
          9,
          10,
          11,
          12
        ],
        "x-enum-varnames": [
          "NEW_ORGANIZATION_CREATION_REQUEST",
          "NEW_ORGANIZATION_EDITION_REQUEST",
          "NEW_ORGANIZATION_EDIT_REPLY",
          "NEW_ORGANIZATION_ACCEPT_REPLY",
          "NEW_ORGANIZATION_REJECT_REPLY",
          "CLAN_MEMBER_KICK",
          "RANKED_MATCH_FOUND",
          "REALTIME_EVENT",
          "CLAN_DISBANDED",
          "CLAN_APPLICATION_RECEIVED",
          "CLAN_APPLICATION_ACCEPTED",
          "CLAN_APPLICATION_REJECTED",
          "CLAN_INVITE_RECEIVED"
        ]
      },
      "OpenRegistrationsResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "id": {
            "type": "number"
          },
          "internalState": {
            "$ref": "#/components/schemas/TournamentState"
          }
        },
        "required": [
          "success",
          "id",
          "internalState"
        ]
      },
      "OrganizationDTO": {
        "type": "object",
        "properties": {
          "id": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "number"
              }
            ]
          },
          "state": {
            "$ref": "#/components/schemas/OrganizationState"
          },
          "name": {
            "type": "string"
          },
          "normalizedName": {
            "type": "string"
          },
          "logo": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "owner": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "$ref": "#/components/schemas/UserDTO"
              }
            ]
          },
          "orgManagers": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/UserDTO"
            }
          },
          "managers": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/OrgManagerDTO"
            }
          },
          "preapproved": {
            "type": "boolean"
          },
          "socialMedias": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/SocialMediaDTO"
            }
          },
          "broadcastMedias": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/SocialMediaDTO"
            }
          },
          "origin": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "$ref": "#/components/schemas/Country"
              }
            ]
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "name",
          "normalizedName",
          "logo",
          "description"
        ]
      },
      "OrganizationState": {
        "description": "Cycle de revue d'une organisation (structure e-sport).",
        "type": "number",
        "enum": [
          0,
          1,
          2
        ],
        "x-enum-varnames": [
          "Pending",
          "Approved",
          "Rejected"
        ]
      },
      "OrganizationValidationDTO": {
        "description": "Revue d'une demande de création / édition d'organisation.",
        "type": "object",
        "properties": {
          "id": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "number"
              }
            ]
          },
          "reviewer": {
            "$ref": "#/components/schemas/UserDTO"
          },
          "name": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "logo": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "description": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "twitterUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "instagramUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "tiktokUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "twitchUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "youtubeUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "reviewer",
          "name",
          "logo",
          "description",
          "twitterUrl",
          "instagramUrl",
          "tiktokUrl",
          "twitchUrl",
          "youtubeUrl"
        ]
      },
      "OrgManagerDTO": {
        "type": "object",
        "properties": {
          "organization": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/OrganizationDTO"
              },
              {
                "type": "number"
              }
            ]
          },
          "user": {
            "$ref": "#/components/schemas/UserDTO"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "user"
        ]
      },
      "PagedList": {
        "type": "object",
        "properties": {
          "data": {
            "type": "array",
            "items": {}
          },
          "total": {
            "type": "number"
          },
          "meta": {
            "$ref": "#/components/schemas/PageSizeMeta"
          }
        },
        "required": [
          "data",
          "total",
          "meta"
        ]
      },
      "PageMeta": {
        "description": "Métadonnées de page renvoyées par l'API (style `Paginated<T>` historique).",
        "type": "object",
        "properties": {
          "page": {
            "type": "number",
            "description": "Seul `total` est garanti.\n\nMesuré sur `GET /clans` : l'API renvoie `{ total, pageCount: null }`. Une\nenveloppe de pagination ne doit jamais pouvoir invalider sa charge utile —\nexiger ces champs effaçait les 42 clans pour une histoire de compteur."
          },
          "limit": {
            "type": "number"
          },
          "total": {
            "type": "number"
          },
          "pageCount": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "total"
        ]
      },
      "PageQuery": {
        "description": "Requête de pagination commune à toutes les listes.",
        "type": "object",
        "properties": {
          "page": {
            "type": "number"
          },
          "pageSize": {
            "type": "number"
          }
        }
      },
      "PageSizeMeta": {
        "description": "Variante « pageSize » utilisée par les contrôleurs récents (casts, sanctions,\nnotes joueur). Conservée distincte de `PageMeta` : les deux formes coexistent\nréellement sur l'API, les fusionner casserait un des deux appelants.",
        "type": "object",
        "properties": {
          "page": {
            "type": "number"
          },
          "pageSize": {
            "type": "number"
          },
          "pageCount": {
            "type": "number"
          }
        },
        "required": [
          "page",
          "pageSize",
          "pageCount"
        ]
      },
      "Paginated": {
        "type": "object",
        "properties": {
          "data": {
            "type": "array",
            "items": {}
          },
          "meta": {
            "$ref": "#/components/schemas/PageMeta"
          }
        },
        "required": [
          "data",
          "meta"
        ]
      },
      "ParticipantDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "tournament": {
            "$ref": "#/components/schemas/Tournament"
          },
          "user": {
            "$ref": "#/components/schemas/UserDTO"
          },
          "bracketParticipantId": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "seed": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "hasCheckedIn": {
            "type": "boolean"
          },
          "status": {
            "$ref": "#/components/schemas/ParticipantStatus",
            "description": "Absent sur les réponses d'API antérieures au statut : traiter comme `ACTIVE`."
          },
          "registeredAt": {
            "type": "string"
          },
          "waitlistPosition": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "description": "Rang dans la liste d'attente (1 = prochain promu)."
          },
          "statusReason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Motif de DQ — renseigné uniquement pour les organisateurs."
          }
        },
        "required": [
          "id",
          "tournament",
          "user",
          "hasCheckedIn"
        ]
      },
      "ParticipantMutationResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "error": {
            "type": "string"
          },
          "participant": {
            "$ref": "#/components/schemas/WireParticipant"
          }
        },
        "required": [
          "success"
        ]
      },
      "ParticipantStatus": {
        "description": "Statut d'un inscrit à un tournoi.\n\nUn seul axe pour deux besoins qui portaient sur la même ligne : la liste d'attente\nquand le tournoi est plein, et la disqualification. Seuls les `Active` comptent dans\nla capacité, le seeding et le bracket.",
        "type": "string",
        "enum": [
          "Active",
          "Waitlisted",
          "Disqualified"
        ],
        "x-enum-varnames": [
          "ACTIVE",
          "WAITLISTED",
          "DISQUALIFIED"
        ]
      },
      "PlacementPrizesResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "error": {
            "type": "string"
          },
          "applied": {
            "type": "boolean"
          },
          "reason": {
            "type": "string"
          },
          "deltas": {
            "type": "object",
            "additionalProperties": {
              "type": "number"
            }
          },
          "tournamentSize": {
            "type": "number"
          }
        },
        "required": [
          "success"
        ]
      },
      "PlayerCircuitProfile": {
        "description": "Profil circuit d'un joueur — page profil public `/users/:id`.",
        "type": "object",
        "properties": {
          "tournamentsPlayed": {
            "type": "number"
          },
          "points": {
            "type": "number"
          },
          "tier": {
            "type": "string"
          },
          "wins": {
            "type": "number"
          },
          "podiums": {
            "type": "number"
          },
          "top4": {
            "type": "number"
          },
          "top8": {
            "type": "number"
          },
          "bestRankLabel": {
            "type": "string"
          },
          "goalsScored": {
            "type": "number"
          },
          "goalsConceded": {
            "type": "number"
          },
          "goalAverage": {
            "type": "number"
          },
          "bestStreak": {
            "type": "number"
          },
          "history": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/PlayerTournamentHistoryEntry"
            }
          }
        },
        "required": [
          "tournamentsPlayed",
          "points",
          "tier",
          "wins",
          "podiums",
          "top4",
          "top8",
          "bestRankLabel",
          "goalsScored",
          "goalsConceded",
          "goalAverage",
          "bestStreak",
          "history"
        ]
      },
      "PlayerNote": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "target": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/PlayerNotePerson"
              },
              {
                "type": "null"
              }
            ]
          },
          "author": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/PlayerNotePerson"
              },
              {
                "type": "null"
              }
            ]
          },
          "tournament": {
            "anyOf": [
              {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "number"
                  },
                  "name": {
                    "type": "string"
                  }
                },
                "required": [
                  "id",
                  "name"
                ]
              },
              {
                "type": "null"
              }
            ]
          },
          "category": {
            "$ref": "#/components/schemas/PlayerNoteCategory"
          },
          "severity": {
            "$ref": "#/components/schemas/PlayerNoteSeverity"
          },
          "content": {
            "type": "string"
          },
          "resolved": {
            "type": "boolean"
          },
          "resolvedAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "resolvedBy": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/PlayerNotePerson"
              },
              {
                "type": "null"
              }
            ]
          },
          "createdAt": {
            "type": "string"
          },
          "updatedAt": {
            "type": "string"
          },
          "docsUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Registre Drive où le signalement a été consigné (null si Drive non configuré)."
          }
        },
        "required": [
          "id",
          "target",
          "author",
          "tournament",
          "category",
          "severity",
          "content",
          "resolved",
          "resolvedAt",
          "resolvedBy",
          "createdAt",
          "updatedAt",
          "docsUrl"
        ]
      },
      "PlayerNoteCategory": {
        "description": "Notes du staff sur un joueur (« espace dédié » où les organisateurs consignent ce\nqu'ils ont à dire d'un joueur pendant un tournoi, lisible des autres admins).\n\nDistinct des sanctions : une note est une observation, pas une décision. Elle\nn'entraîne aucune conséquence automatique et n'est jamais montrée au joueur.",
        "type": "string",
        "enum": [
          "behavior",
          "cheating",
          "no_show",
          "score_dispute",
          "positive",
          "other"
        ],
        "x-enum-varnames": [
          "BEHAVIOR",
          "CHEATING",
          "NO_SHOW",
          "SCORE_DISPUTE",
          "POSITIVE",
          "OTHER"
        ]
      },
      "PlayerNoteFilters": {
        "type": "object",
        "properties": {
          "page": {
            "type": "number"
          },
          "pageSize": {
            "type": "number"
          },
          "targetId": {
            "type": "string"
          },
          "tournamentId": {
            "type": "number"
          },
          "category": {
            "$ref": "#/components/schemas/PlayerNoteCategory"
          },
          "severity": {
            "$ref": "#/components/schemas/PlayerNoteSeverity"
          },
          "resolved": {
            "type": "boolean"
          }
        }
      },
      "PlayerNoteFiltersExtra": {
        "description": "Filtres additionnels acceptés par la liste des notes.",
        "type": "object",
        "properties": {
          "category": {
            "$ref": "#/components/schemas/PlayerNoteCategory"
          },
          "severity": {
            "$ref": "#/components/schemas/PlayerNoteSeverity"
          },
          "search": {
            "type": "string"
          }
        }
      },
      "PlayerNoteListResponse": {
        "type": "object",
        "properties": {
          "data": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/PlayerNote"
            }
          },
          "total": {
            "type": "number"
          },
          "meta": {
            "type": "object",
            "properties": {
              "page": {
                "type": "number"
              },
              "pageSize": {
                "type": "number"
              },
              "pageCount": {
                "type": "number"
              },
              "isStaff": {
                "type": "boolean"
              }
            },
            "required": [
              "page",
              "pageSize",
              "pageCount",
              "isStaff"
            ]
          }
        },
        "required": [
          "data",
          "total",
          "meta"
        ]
      },
      "PlayerNotePerson": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "username": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "username",
          "displayName",
          "avatar"
        ]
      },
      "PlayerNoteSeverity": {
        "type": "string",
        "enum": [
          "info",
          "warning",
          "serious"
        ],
        "x-enum-varnames": [
          "INFO",
          "WARNING",
          "SERIOUS"
        ]
      },
      "PlayerNoteSummary": {
        "type": "object",
        "properties": {
          "total": {
            "type": "number"
          },
          "open": {
            "type": "number"
          },
          "bySeverity": {
            "type": "object",
            "additionalProperties": {
              "type": "number"
            }
          }
        },
        "required": [
          "total",
          "open",
          "bySeverity"
        ]
      },
      "PlayerTournamentHistoryEntry": {
        "type": "object",
        "properties": {
          "tournamentId": {
            "type": "number"
          },
          "tournamentName": {
            "type": "string"
          },
          "grandFinalAt": {
            "type": "string"
          },
          "size": {
            "type": "number"
          },
          "rank": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "rankLabel": {
            "type": "string"
          },
          "points": {
            "type": "number"
          },
          "tier": {
            "type": "string"
          },
          "goalsScored": {
            "type": "number"
          },
          "goalsConceded": {
            "type": "number"
          }
        },
        "required": [
          "tournamentId",
          "tournamentName",
          "grandFinalAt",
          "size",
          "rank",
          "rankLabel",
          "points",
          "tier",
          "goalsScored",
          "goalsConceded"
        ]
      },
      "Rank": {
        "description": "Palier de classement nommé (bornes Elo + dégradé).",
        "type": "object",
        "properties": {
          "label": {
            "type": "string"
          },
          "minElo": {
            "type": "number"
          },
          "maxElo": {
            "type": "number"
          },
          "gradient": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "label",
          "minElo",
          "maxElo",
          "gradient"
        ]
      },
      "RankDTO": {
        "description": "Palier de rang tel qu'exposé sur un profil (clé FR + dégradé d'affichage).",
        "type": "object",
        "properties": {
          "elo": {
            "type": "number"
          },
          "key": {
            "type": "string"
          },
          "gradient": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "elo",
          "key",
          "gradient"
        ]
      },
      "RankedActiveMatch": {
        "description": "Un match ranked EN COURS (lobby `Ongoing`), avec son état live persisté.",
        "type": "object",
        "properties": {
          "lobbyId": {
            "type": "number"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "createdAt": {
            "type": "string"
          },
          "player1": {
            "$ref": "#/components/schemas/RankedActivePlayer",
            "description": "Domicile (team 1)."
          },
          "player2": {
            "$ref": "#/components/schemas/RankedActivePlayer",
            "description": "Extérieur (team 2)."
          }
        },
        "required": [
          "lobbyId",
          "mode",
          "createdAt",
          "player1",
          "player2"
        ]
      },
      "RankedActivePlayer": {
        "description": "Un joueur d'un match EN COURS (vue admin « Matchs en cours »).",
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "score": {
            "type": "number"
          },
          "claimedOpponentScore": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "submitted": {
            "type": "boolean"
          },
          "hasProof": {
            "type": "boolean"
          }
        },
        "required": [
          "userId",
          "displayName",
          "score",
          "claimedOpponentScore",
          "submitted",
          "hasProof"
        ]
      },
      "RankedAdminDispute": {
        "type": "object",
        "properties": {
          "lobbyId": {
            "type": "number"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "player1": {
            "$ref": "#/components/schemas/RankedDisputePlayer"
          },
          "player2": {
            "$ref": "#/components/schemas/RankedDisputePlayer"
          },
          "createdAt": {
            "type": "string"
          }
        },
        "required": [
          "lobbyId",
          "mode",
          "player1",
          "player2",
          "createdAt"
        ]
      },
      "RankedAdminSeason": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "state": {
            "$ref": "#/components/schemas/SeasonState"
          },
          "startsAt": {
            "type": "string"
          },
          "endsAt": {
            "type": "string"
          },
          "config": {
            "$ref": "#/components/schemas/RankedSeasonConfig"
          },
          "playerCount": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "name",
          "state",
          "startsAt",
          "endsAt",
          "config",
          "playerCount"
        ]
      },
      "RankedAdminValidateRequest": {
        "type": "object",
        "properties": {
          "scoreTeam1": {
            "type": "number"
          },
          "scoreTeam2": {
            "type": "number"
          },
          "forfeitUserId": {
            "type": "string"
          }
        },
        "required": [
          "scoreTeam1",
          "scoreTeam2"
        ]
      },
      "RankedAdminValidateResult": {
        "type": "object",
        "properties": {
          "ok": {
            "type": "boolean"
          },
          "eloDelta": {
            "type": "object",
            "properties": {
              "p1": {
                "type": "number"
              },
              "p2": {
                "type": "number"
              }
            },
            "required": [
              "p1",
              "p2"
            ],
            "description": "Variation appliquée à chaque joueur, telle que la renvoie le serveur ranked."
          }
        },
        "required": [
          "ok"
        ]
      },
      "RankedChallengeAccepted": {
        "description": "`POST /ranked/challenge/:code/accept` — la réservation temps réel est opaque.",
        "type": "object",
        "properties": {
          "reservation": {},
          "mode": {
            "type": "number"
          },
          "ranked": {
            "type": "boolean"
          }
        },
        "required": [
          "reservation",
          "mode",
          "ranked"
        ]
      },
      "RankedChallengeLink": {
        "description": "Défi par lien partageable créé par le joueur courant (en attente d'acceptation).",
        "type": "object",
        "properties": {
          "code": {
            "type": "string"
          },
          "url": {
            "type": "string"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "ranked": {
            "type": "boolean"
          },
          "toUserId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "expiresAt": {
            "type": "number"
          }
        },
        "required": [
          "code",
          "url",
          "mode",
          "ranked",
          "toUserId",
          "expiresAt"
        ]
      },
      "RankedChallengePreview": {
        "description": "Aperçu d'un défi reçu via un lien.",
        "type": "object",
        "properties": {
          "code": {
            "type": "string"
          },
          "fromUserId": {
            "type": "string"
          },
          "fromDisplayName": {
            "type": "string"
          },
          "fromAvatar": {
            "type": "string"
          },
          "fromElo": {
            "type": "number"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "ranked": {
            "type": "boolean"
          },
          "isOwn": {
            "type": "boolean"
          },
          "expiresAt": {
            "type": "number"
          }
        },
        "required": [
          "code",
          "fromUserId",
          "fromDisplayName",
          "fromAvatar",
          "fromElo",
          "mode",
          "ranked",
          "isOwn",
          "expiresAt"
        ]
      },
      "RankedChatMessage": {
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          },
          "text": {
            "type": "string"
          },
          "at": {
            "type": "number"
          }
        },
        "required": [
          "userId",
          "text",
          "at"
        ]
      },
      "RankedDisputePlayer": {
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "submittedScore": {
            "type": "number",
            "description": "Score que CE joueur réclame pour lui-même."
          },
          "claimedOpponentScore": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "description": "Score qu'il attribue à l'adversaire."
          },
          "screenshotUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "userId",
          "displayName",
          "submittedScore"
        ]
      },
      "RankedDisputeRequest": {
        "type": "object",
        "properties": {
          "lobbyId": {
            "type": "number"
          },
          "screenshotUrl": {
            "type": "string"
          }
        },
        "required": [
          "lobbyId",
          "screenshotUrl"
        ]
      },
      "RankedHistoryEntry": {
        "type": "object",
        "properties": {
          "lobbyId": {
            "type": "number"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "state": {
            "type": "string"
          },
          "endedAt": {
            "type": "string"
          },
          "myScore": {
            "type": "number"
          },
          "opponentScore": {
            "type": "number"
          },
          "eloDelta": {
            "type": "number"
          },
          "result": {
            "$ref": "#/components/schemas/MatchResult"
          },
          "opponent": {
            "type": "object",
            "properties": {
              "userId": {
                "type": "string"
              },
              "displayName": {
                "type": "string"
              },
              "avatar": {
                "type": "string"
              }
            },
            "required": [
              "userId",
              "displayName",
              "avatar"
            ]
          }
        },
        "required": [
          "lobbyId",
          "mode",
          "state",
          "endedAt",
          "myScore",
          "opponentScore",
          "eloDelta",
          "result",
          "opponent"
        ]
      },
      "RankedLadderResetResult": {
        "type": "object",
        "properties": {
          "ok": {
            "type": "boolean"
          },
          "affected": {
            "type": "number"
          }
        },
        "required": [
          "ok",
          "affected"
        ]
      },
      "RankedLobbyPlayer": {
        "description": "Joueur présent dans le salon de présence ranked, pour le défi direct.",
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          },
          "elo": {
            "type": "number"
          },
          "mode": {
            "type": "number"
          }
        },
        "required": [
          "userId",
          "displayName",
          "avatar",
          "elo",
          "mode"
        ]
      },
      "RankedMatchEvent": {
        "description": "Un événement de télémétrie ranked (journal du flow des matchs, vue staff).",
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "createdAt": {
            "type": "string"
          },
          "lobbyId": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "roomCode": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "mode": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "userId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "displayName": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "type": {
            "type": "string"
          },
          "detail": {
            "type": "object",
            "additionalProperties": {}
          }
        },
        "required": [
          "id",
          "createdAt",
          "lobbyId",
          "roomCode",
          "mode",
          "userId",
          "displayName",
          "type",
          "detail"
        ]
      },
      "RankedMatchSummary": {
        "type": "object",
        "properties": {
          "lobbyId": {
            "type": "number"
          },
          "roomCode": {
            "type": "string"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "ranked": {
            "type": "boolean",
            "description": "`false` = partie amicale (aucun ELO appliqué)."
          },
          "opponent": {
            "type": "object",
            "properties": {
              "userId": {
                "type": "string"
              },
              "displayName": {
                "type": "string"
              },
              "avatar": {
                "type": "string"
              }
            },
            "required": [
              "userId",
              "displayName",
              "avatar"
            ]
          },
          "result": {
            "$ref": "#/components/schemas/MatchResult"
          },
          "myScore": {
            "type": "number"
          },
          "opponentScore": {
            "type": "number"
          },
          "eloBefore": {
            "type": "number"
          },
          "eloAfter": {
            "type": "number"
          },
          "eloDelta": {
            "type": "number"
          },
          "newTier": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/RankTier"
              },
              {
                "type": "null"
              }
            ]
          },
          "endedAt": {
            "type": "string"
          }
        },
        "required": [
          "lobbyId",
          "roomCode",
          "mode",
          "opponent",
          "result",
          "myScore",
          "opponentScore",
          "eloBefore",
          "eloAfter",
          "eloDelta",
          "newTier",
          "endedAt"
        ]
      },
      "RankedModeStats": {
        "type": "object",
        "properties": {
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "total": {
            "type": "number"
          },
          "wins": {
            "type": "number"
          },
          "losses": {
            "type": "number"
          },
          "draws": {
            "type": "number"
          },
          "goalsScored": {
            "type": "number"
          },
          "goalsReceived": {
            "type": "number"
          }
        },
        "required": [
          "mode",
          "total",
          "wins",
          "losses",
          "draws",
          "goalsScored",
          "goalsReceived"
        ]
      },
      "RankedOverview": {
        "description": "Compteurs synthétiques du ranked (vue admin overview).",
        "type": "object",
        "properties": {
          "activeMatches": {
            "type": "number"
          },
          "contestedMatches": {
            "type": "number"
          },
          "finishedToday": {
            "type": "number"
          },
          "matchesToday": {
            "type": "number"
          },
          "totalPlayers": {
            "type": "number"
          }
        },
        "required": [
          "activeMatches",
          "contestedMatches",
          "finishedToday",
          "matchesToday",
          "totalPlayers"
        ]
      },
      "RankedPendingInvite": {
        "description": "Invitation reçue (on est défié par un autre joueur).",
        "type": "object",
        "properties": {
          "fromUserId": {
            "type": "string"
          },
          "fromDisplayName": {
            "type": "string"
          },
          "fromAvatar": {
            "type": "string"
          },
          "fromElo": {
            "type": "number"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "ranked": {
            "type": "boolean",
            "description": "Classé (ELO) ou non classé (amical)."
          }
        },
        "required": [
          "fromUserId",
          "fromDisplayName",
          "fromAvatar",
          "fromElo",
          "mode",
          "ranked"
        ]
      },
      "RankedPlayerView": {
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          },
          "elo": {
            "type": "number"
          },
          "team": {
            "type": "number",
            "description": "Côté terrain : 1 = domicile (1er joueur), 2 = extérieur (2e joueur). 0 = non assigné."
          },
          "myScore": {
            "type": "number",
            "description": "Saisie du score (double validation), du point de vue du joueur (−1 = non saisi)."
          },
          "oppScore": {
            "type": "number"
          },
          "startedMatch": {
            "type": "boolean",
            "description": "A cliqué « Début de match »."
          },
          "submitted": {
            "type": "boolean",
            "description": "A validé sa saisie de score."
          },
          "proofUploaded": {
            "type": "boolean",
            "description": "A uploadé sa capture de preuve."
          },
          "confirmedFinish": {
            "type": "boolean",
            "description": "A cliqué « Fin de match »."
          }
        },
        "required": [
          "userId",
          "displayName",
          "avatar",
          "elo",
          "team",
          "myScore",
          "oppScore",
          "startedMatch",
          "submitted",
          "proofUploaded",
          "confirmedFinish"
        ]
      },
      "RankedProfile": {
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "elo": {
            "type": "number"
          },
          "peakRating": {
            "type": "number"
          },
          "gamesPlayed": {
            "type": "number"
          },
          "wins": {
            "type": "number"
          },
          "losses": {
            "type": "number"
          },
          "tier": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/RankTier"
              },
              {
                "type": "null"
              }
            ]
          },
          "seasonId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "globalRank": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "totalPlayers": {
            "type": "number"
          },
          "percentile": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "userId",
          "mode",
          "elo",
          "peakRating",
          "gamesPlayed",
          "wins",
          "losses",
          "tier",
          "seasonId"
        ]
      },
      "RankedProofUploaded": {
        "description": "`POST /ranked/:lobbyId/dispute` — URL de la preuve stockée.",
        "type": "object",
        "properties": {
          "url": {
            "type": "string"
          }
        },
        "required": [
          "url"
        ]
      },
      "RankedRematchOffer": {
        "description": "Proposition de revanche reçue en temps réel (`rematch_offer`).",
        "type": "object",
        "properties": {
          "code": {
            "type": "string"
          },
          "fromUserId": {
            "type": "string"
          },
          "fromDisplayName": {
            "type": "string"
          },
          "fromAvatar": {
            "type": "string"
          },
          "fromElo": {
            "type": "number"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "ranked": {
            "type": "boolean"
          },
          "url": {
            "type": "string"
          }
        },
        "required": [
          "code",
          "fromUserId",
          "fromDisplayName",
          "fromAvatar",
          "fromElo",
          "mode",
          "ranked",
          "url"
        ]
      },
      "RankedSeasonConfig": {
        "type": "object",
        "properties": {
          "kFactor": {
            "type": "number"
          },
          "baseRating": {
            "type": "number"
          },
          "decayRate": {
            "type": "number"
          }
        },
        "required": [
          "kFactor",
          "baseRating",
          "decayRate"
        ]
      },
      "RankedSeasonInput": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "startsAt": {
            "type": "string"
          },
          "endsAt": {
            "type": "string"
          },
          "config": {
            "$ref": "#/components/schemas/RankedSeasonConfig"
          }
        },
        "required": [
          "name",
          "startsAt",
          "endsAt",
          "config"
        ]
      },
      "RankedSentInvite": {
        "description": "Invitation envoyée (on a défié un joueur, en attente de sa réponse).",
        "type": "object",
        "properties": {
          "targetUserId": {
            "type": "string"
          },
          "targetDisplayName": {
            "type": "string"
          },
          "mode": {
            "$ref": "#/components/schemas/MatchMode"
          },
          "ranked": {
            "type": "boolean"
          }
        },
        "required": [
          "targetUserId",
          "targetDisplayName",
          "mode",
          "ranked"
        ]
      },
      "RankedState": {
        "type": "string",
        "enum": [
          "Open",
          "Locked",
          "Validating presence",
          "Pairing",
          "Validating start",
          "Repooling",
          "Matching",
          "Finished",
          "Canceled"
        ],
        "x-enum-varnames": [
          "OPEN",
          "LOCKED",
          "VALIDATING_PRESENCE",
          "PAIRING",
          "VALIDATING_MATCH_START",
          "REPOOLING",
          "MATCHING",
          "FINISHED",
          "CANCELED"
        ]
      },
      "RankedTierInfo": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string"
          },
          "minElo": {
            "type": "number"
          },
          "maxElo": {
            "type": "number"
          },
          "gradient": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "emojiId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "emojiKey": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "playerCount": {
            "type": "number"
          }
        },
        "required": [
          "key",
          "minElo",
          "maxElo",
          "gradient",
          "emojiId",
          "emojiKey",
          "playerCount"
        ]
      },
      "RankedTrend": {
        "type": "object",
        "properties": {
          "sparkline": {
            "type": "array",
            "items": {
              "type": "number"
            }
          },
          "deltaPeriod": {
            "type": "number"
          },
          "gamesInPeriod": {
            "type": "number"
          },
          "winRatePeriod": {
            "type": "number"
          },
          "days": {
            "type": "number"
          }
        },
        "required": [
          "sparkline",
          "deltaPeriod",
          "gamesInPeriod",
          "winRatePeriod",
          "days"
        ]
      },
      "RankTier": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string"
          },
          "minElo": {
            "type": "number"
          },
          "maxElo": {
            "type": "number"
          },
          "emojiId": {
            "type": "string"
          },
          "emojiKey": {
            "type": "string"
          },
          "gradient": {
            "type": "array",
            "items": {
              "type": "string"
            }
          }
        },
        "required": [
          "key",
          "minElo",
          "maxElo",
          "emojiId",
          "emojiKey",
          "gradient"
        ]
      },
      "RealtimeTokenResponse": {
        "description": "`GET /auth/token` — jeton court destiné au client temps réel.",
        "type": "object",
        "properties": {
          "token": {
            "type": "string"
          },
          "expiresIn": {
            "type": "number"
          },
          "userId": {
            "type": "string"
          }
        },
        "required": [
          "token",
          "expiresIn",
          "userId"
        ]
      },
      "RestoreTournamentResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "error": {
            "type": "string"
          },
          "internalState": {
            "$ref": "#/components/schemas/TournamentState"
          }
        },
        "required": [
          "success"
        ]
      },
      "RoundRobinMode": {
        "description": "`brackets-model#RoundRobinMode`.",
        "enum": [
          "simple",
          "double"
        ]
      },
      "Sanction": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "userId": {
            "type": "string"
          },
          "guildId": {
            "type": "string"
          },
          "type": {
            "$ref": "#/components/schemas/SanctionType"
          },
          "reason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "durationSec": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "issuedBy": {
            "type": "string"
          },
          "issuedByType": {
            "$ref": "#/components/schemas/SanctionIssuerType"
          },
          "expiresAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "revokedAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "revokedBy": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "revokeReason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "evidence": {
            "anyOf": [
              {
                "type": "array",
                "items": {
                  "type": "object",
                  "additionalProperties": {}
                }
              },
              {
                "type": "null"
              }
            ]
          },
          "createdAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "userId",
          "guildId",
          "type",
          "reason",
          "durationSec",
          "issuedBy",
          "issuedByType",
          "expiresAt",
          "revokedAt",
          "revokedBy",
          "revokeReason",
          "evidence",
          "createdAt"
        ]
      },
      "SanctionFilters": {
        "type": "object",
        "properties": {
          "page": {
            "type": "number"
          },
          "pageSize": {
            "type": "number"
          },
          "userId": {
            "type": "string"
          },
          "guildId": {
            "type": "string"
          },
          "type": {
            "$ref": "#/components/schemas/SanctionType"
          },
          "active": {
            "type": "boolean"
          }
        }
      },
      "SanctionIssuerType": {
        "description": "Origine d'une sanction (qui / quoi l'a émise).",
        "type": "string",
        "enum": [
          "user",
          "bot",
          "staff",
          "system"
        ],
        "x-enum-varnames": [
          "User",
          "Bot",
          "Staff",
          "System"
        ]
      },
      "SanctionListResponse": {
        "$ref": "#/components/schemas/PagedList"
      },
      "SanctionType": {
        "description": "Types de sanction de modération.",
        "type": "string",
        "enum": [
          "warn",
          "mute",
          "kick",
          "ban",
          "unmute",
          "unban",
          "note"
        ],
        "x-enum-varnames": [
          "Warn",
          "Mute",
          "Kick",
          "Ban",
          "Unmute",
          "Unban",
          "Note"
        ]
      },
      "ScorePolicyResult": {
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "scoreReportPolicy": {
            "$ref": "#/components/schemas/ScoreReportPolicy"
          },
          "error": {
            "type": "string"
          }
        },
        "required": [
          "success",
          "scoreReportPolicy"
        ]
      },
      "ScoreReportPolicy": {
        "description": "Qui saisit les scores des matchs d'un tournoi.\n\n`PLAYERS` est le comportement historique : les deux joueurs d'un lobby remplissent\neux-mêmes leur score, puis le valident chacun de leur côté (ou un organisateur\ntranche). `STAFF_ONLY` réserve saisie et validation aux organisateurs — les joueurs\ngardent la lecture du match, sans aucun bouton.",
        "type": "string",
        "enum": [
          "players",
          "staff_only"
        ],
        "x-enum-varnames": [
          "PLAYERS",
          "STAFF_ONLY"
        ]
      },
      "SeasonState": {
        "enum": [
          "Upcoming",
          "Active",
          "Closed"
        ]
      },
      "SeedBatchResult": {
        "type": "object",
        "properties": {
          "mode": {
            "type": "string"
          },
          "bracketUpdated": {
            "type": "boolean"
          },
          "assignments": {
            "type": "array",
            "items": {}
          },
          "cleared": {
            "type": "number"
          }
        },
        "required": [
          "mode",
          "bracketUpdated"
        ]
      },
      "SeedingResult": {
        "type": "object",
        "properties": {
          "participantId": {
            "type": "number"
          },
          "seed": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "previousSeed": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "swappedWith": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "bracketUpdated": {
            "type": "boolean"
          }
        },
        "required": [
          "participantId",
          "seed",
          "previousSeed",
          "swappedWith",
          "bracketUpdated"
        ]
      },
      "SeedOrdering": {
        "description": "`brackets-model#SeedOrdering`.",
        "enum": [
          "natural",
          "reverse",
          "half_shift",
          "reverse_half_shift",
          "pair_flip",
          "inner_outer",
          "groups.effort_balanced",
          "groups.seed_optimized",
          "groups.bracket_optimized"
        ]
      },
      "SessionRankDTO": {
        "description": "Rang tel qu'embarqué dans une session ou une suggestion.",
        "$ref": "#/components/schemas/RankDTO"
      },
      "SessionUserDTO": {
        "description": "Utilisateur de session — ce que renvoie `/auth/me`.\n\nMême forme que `UserDTO` : l'API sert le même objet, `type` en moins. Alias\nplutôt que type distinct, pour qu'un utilisateur de session puisse alimenter\nn'importe quelle référence utilisateur (organisateur, manager, propriétaire).",
        "$ref": "#/components/schemas/UserDTO"
      },
      "SocialMedia": {
        "type": "number",
        "enum": [
          0,
          1,
          2,
          3,
          4
        ],
        "x-enum-varnames": [
          "X",
          "Instagram",
          "TikTok",
          "Youtube",
          "Twitch"
        ]
      },
      "SocialMediaDTO": {
        "type": "object",
        "properties": {
          "platform": {
            "$ref": "#/components/schemas/SocialMedia"
          },
          "username": {
            "type": "string"
          },
          "canonicalUrl": {
            "type": "string"
          }
        },
        "required": [
          "platform",
          "username",
          "canonicalUrl"
        ]
      },
      "SortDirection": {
        "enum": [
          "asc",
          "desc"
        ]
      },
      "SortQuery": {
        "type": "object",
        "properties": {
          "sortBy": {},
          "sortDir": {
            "$ref": "#/components/schemas/SortDirection"
          }
        }
      },
      "StageType": {
        "type": "string",
        "enum": [
          "round_robin",
          "single_elimination",
          "double_elimination",
          "league"
        ],
        "x-enum-varnames": [
          "round_robin",
          "single_elimination",
          "double_elimination",
          "league"
        ]
      },
      "StatsHub": {
        "type": "object",
        "properties": {
          "overview": {
            "type": "object",
            "properties": {
              "totalTournaments": {
                "type": "number"
              },
              "totalMatches": {
                "type": "number"
              },
              "totalGoals": {
                "type": "number"
              },
              "avgGoalsPerMatch": {
                "type": "number"
              },
              "totalPlayers": {
                "type": "number"
              },
              "totalClans": {
                "type": "number"
              }
            },
            "required": [
              "totalTournaments",
              "totalMatches",
              "totalGoals",
              "avgGoalsPerMatch",
              "totalPlayers",
              "totalClans"
            ]
          },
          "records": {
            "type": "object",
            "properties": {
              "topScorer": {
                "anyOf": [
                  {
                    "$ref": "#/components/schemas/StatsHubPlayerEntry"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "mostTitles": {
                "anyOf": [
                  {
                    "$ref": "#/components/schemas/StatsHubPlayerEntry"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "mostTournaments": {
                "anyOf": [
                  {
                    "$ref": "#/components/schemas/StatsHubPlayerEntry"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "bestStreakPlayer": {
                "anyOf": [
                  {
                    "$ref": "#/components/schemas/StatsHubPlayerEntry"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "biggestTournament": {
                "anyOf": [
                  {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "number"
                      },
                      "name": {
                        "type": "string"
                      },
                      "size": {
                        "type": "number"
                      }
                    },
                    "required": [
                      "id",
                      "name",
                      "size"
                    ]
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "highestScoringMatch": {
                "anyOf": [
                  {
                    "$ref": "#/components/schemas/StatsHubRecord"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "closestFinal": {
                "anyOf": [
                  {
                    "$ref": "#/components/schemas/StatsHubRecord"
                  },
                  {
                    "type": "null"
                  }
                ]
              },
              "biggestBlowoutFinal": {
                "anyOf": [
                  {
                    "$ref": "#/components/schemas/StatsHubRecord"
                  },
                  {
                    "type": "null"
                  }
                ]
              }
            },
            "required": [
              "topScorer",
              "mostTitles",
              "mostTournaments",
              "bestStreakPlayer",
              "biggestTournament",
              "highestScoringMatch",
              "closestFinal",
              "biggestBlowoutFinal"
            ]
          },
          "players": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/StatsHubPlayerEntry"
            }
          },
          "clans": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/StatsHubClanEntry"
            }
          },
          "tournamentHistory": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/StatsHubTournamentHistoryEntry"
            }
          },
          "tournaments": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/CircuitTournamentSummary"
            }
          }
        },
        "required": [
          "overview",
          "records",
          "players",
          "clans",
          "tournamentHistory",
          "tournaments"
        ]
      },
      "StatsHubClanEntry": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "shortName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          },
          "points": {
            "type": "number"
          },
          "players": {
            "type": "number"
          },
          "tournamentsPlayed": {
            "type": "number"
          },
          "wins": {
            "type": "number"
          },
          "podiums": {
            "type": "number"
          },
          "tier": {
            "type": "string"
          },
          "goalsScored": {
            "type": "number"
          },
          "goalsConceded": {
            "type": "number"
          },
          "goalAverage": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "name",
          "shortName",
          "avatar",
          "points",
          "players",
          "tournamentsPlayed",
          "wins",
          "podiums",
          "tier",
          "goalsScored",
          "goalsConceded",
          "goalAverage"
        ]
      },
      "StatsHubPlayerEntry": {
        "description": "Joueur enrichi des stats matchs (buts, séries) pour le hub stats circuit.",
        "type": "object",
        "properties": {
          "userId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "username": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          },
          "clan": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/CircuitClanTag"
              },
              {
                "type": "null"
              }
            ]
          },
          "tournamentsPlayed": {
            "type": "number"
          },
          "points": {
            "type": "number"
          },
          "tournaments": {
            "type": "number"
          },
          "wins": {
            "type": "number"
          },
          "podiums": {
            "type": "number"
          },
          "top4": {
            "type": "number"
          },
          "top8": {
            "type": "number"
          },
          "bestRank": {
            "type": "number"
          },
          "bestRankLabel": {
            "type": "string"
          },
          "tier": {
            "type": "string",
            "description": "Palier circuit — mêmes clés que le ranked (Fer → Légendaire)."
          },
          "matchesPlayed": {
            "type": "number"
          },
          "matchWins": {
            "type": "number"
          },
          "matchLosses": {
            "type": "number"
          },
          "goalsScored": {
            "type": "number"
          },
          "goalsConceded": {
            "type": "number"
          },
          "goalDiff": {
            "type": "number"
          },
          "goalAverage": {
            "type": "number",
            "description": "Buts marqués / encaissés — départage à points égaux."
          },
          "bestStreak": {
            "type": "number"
          }
        },
        "required": [
          "userId",
          "displayName",
          "username",
          "avatar",
          "clan",
          "tournamentsPlayed",
          "points",
          "tournaments",
          "wins",
          "podiums",
          "top4",
          "top8",
          "bestRank",
          "bestRankLabel",
          "tier",
          "matchesPlayed",
          "matchWins",
          "matchLosses",
          "goalsScored",
          "goalsConceded",
          "goalDiff",
          "goalAverage",
          "bestStreak"
        ]
      },
      "StatsHubRecord": {
        "type": "object",
        "properties": {
          "value": {
            "type": "number"
          },
          "tournamentId": {
            "type": "number"
          },
          "tournamentName": {
            "type": "string"
          },
          "detail": {
            "type": "string"
          }
        },
        "required": [
          "value",
          "tournamentId",
          "tournamentName",
          "detail"
        ]
      },
      "StatsHubTournamentHistoryEntry": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "grandFinalAt": {
            "type": "string"
          },
          "size": {
            "type": "number"
          },
          "matches": {
            "type": "number"
          },
          "goals": {
            "type": "number"
          },
          "champion": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "runnerUp": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "name",
          "grandFinalAt",
          "size",
          "matches",
          "goals",
          "champion",
          "runnerUp"
        ]
      },
      "SuccessResponse": {
        "description": "Réponse des mutations : `{ success, error? }`.",
        "type": "object",
        "properties": {
          "success": {
            "type": "boolean"
          },
          "error": {
            "type": "string"
          }
        },
        "required": [
          "success"
        ]
      },
      "Suggestion": {
        "description": "Entrée d'autocomplétion globale (barre de recherche clans + joueurs).",
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "type": {
            "enum": [
              "clan",
              "user"
            ]
          },
          "label": {
            "type": "string"
          },
          "sim": {
            "type": "number"
          },
          "clanShortName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          },
          "soloRank": {
            "$ref": "#/components/schemas/SuggestionRank"
          },
          "duoRank": {
            "$ref": "#/components/schemas/SuggestionRank"
          },
          "lastInteract": {
            "type": "string",
            "format": "date-time"
          },
          "role": {
            "$ref": "#/components/schemas/UserRole"
          },
          "currentLevel": {
            "type": "number"
          },
          "totalXp": {
            "type": "number"
          },
          "hasTwitch": {
            "type": "boolean"
          },
          "hasChallonge": {
            "type": "boolean"
          },
          "hasYoutube": {
            "type": "boolean"
          }
        },
        "required": [
          "id",
          "type",
          "label",
          "sim",
          "soloRank",
          "duoRank"
        ]
      },
      "SuggestionRank": {
        "description": "Alias historique de `SessionRankDTO` (mêmes champs, même origine).",
        "$ref": "#/components/schemas/SessionRankDTO"
      },
      "TeamSide": {
        "type": "number",
        "enum": [
          1,
          2
        ],
        "x-enum-varnames": [
          "TEAM_1",
          "TEAM_2"
        ]
      },
      "Tournament": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "type": {
            "$ref": "#/components/schemas/EventTypeEnum"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "internalState": {
            "$ref": "#/components/schemas/TournamentState"
          },
          "startsAt": {
            "type": "string",
            "format": "date-time"
          },
          "grandFinalAt": {
            "type": "string",
            "format": "date-time"
          },
          "series": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/TournamentSeries"
              },
              {
                "type": "null"
              }
            ]
          },
          "organization": {
            "$ref": "#/components/schemas/OrganizationDTO"
          },
          "managers": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/UserDTO"
            }
          },
          "participants": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ParticipantDTO"
            }
          },
          "tournamentType": {
            "$ref": "#/components/schemas/StageType"
          },
          "participantsNumber": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "seedOrdering": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/SeedOrdering"
              },
              {
                "type": "null"
              }
            ]
          },
          "matchFormat": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/MatchFormat"
              },
              {
                "type": "null"
              }
            ]
          },
          "customFormatChildCount": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "groupStageEnabled": {
            "type": "boolean"
          },
          "groupStageType": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/StageType"
              },
              {
                "type": "null"
              }
            ]
          },
          "logo": {
            "type": "string"
          },
          "affiche": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "planning": {
            "type": "string"
          },
          "ruleset": {
            "type": "string"
          },
          "placementEloApplied": {
            "type": "boolean",
            "description": "True une fois le bonus AP podium (top 4) versé.\nAbsent / false tant que non appliqué (tournois en cours ou formats hors scope)."
          },
          "registrationOpensAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Planning automatisé (voir `docs/plan-tournois.md`)."
          },
          "registrationClosesAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "autoStart": {
            "type": "boolean"
          },
          "discordRoleEnabled": {
            "type": "boolean"
          },
          "scoreReportPolicy": {
            "$ref": "#/components/schemas/ScoreReportPolicy",
            "description": "Qui saisit les scores (absent sur un tournoi d'avant l'option = joueurs)."
          },
          "discordRoleId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Rôle Discord attribué aux inscrits, créé à l'ouverture des inscriptions."
          },
          "cancelReason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Renseignés quand le tournoi a été annulé (l'entité reste en base)."
          },
          "canceledAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "closedAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Horodatage d'une clôture manuelle (null si passage automatique en Terminé)."
          }
        },
        "required": [
          "id",
          "name",
          "description",
          "type",
          "createdAt",
          "updatedAt",
          "internalState",
          "startsAt",
          "grandFinalAt",
          "organization",
          "tournamentType",
          "groupStageEnabled",
          "logo",
          "planning",
          "ruleset"
        ]
      },
      "TournamentDetail": {
        "description": "Réponse de `GET /tournaments/:id` — un triplet, pas un objet : c'est la\nforme réellement servie. Le décrire tel quel évite qu'un client invente une\nnormalisation que le suivant ne ferait pas.\n\n`[tournoi, inscrits, données brutes de brackets-manager]`.",
        "type": "array",
        "prefixItems": [
          {
            "$ref": "#/components/schemas/WireTournament"
          },
          {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/WireParticipant"
            }
          },
          {}
        ],
        "items": false,
        "minItems": 3,
        "maxItems": 3
      },
      "TournamentEnvelope": {
        "description": "Enveloppe générique des mutations de tournoi.",
        "$ref": "#/components/schemas/ApiEnvelope"
      },
      "TournamentEventActor": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "username": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "username",
          "displayName",
          "avatar"
        ]
      },
      "TournamentEventDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "type": {
            "$ref": "#/components/schemas/TournamentEventType"
          },
          "createdAt": {
            "type": "string"
          },
          "actor": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/TournamentEventActor"
              },
              {
                "type": "null"
              }
            ]
          },
          "target": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/TournamentEventActor"
              },
              {
                "type": "null"
              }
            ]
          },
          "payload": {
            "anyOf": [
              {
                "type": "object",
                "additionalProperties": {}
              },
              {
                "type": "null"
              }
            ]
          },
          "reason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Motif (DQ, annulation) — null pour les non-organisateurs."
          }
        },
        "required": [
          "id",
          "type",
          "createdAt",
          "actor",
          "target",
          "payload",
          "reason"
        ]
      },
      "TournamentEventType": {
        "description": "Évènements journalisés d'un tournoi (table `tournament_event`).\n\nJournal métier destiné à l'affichage — distinct d'`audit_log`, qui est un journal ops\nsigné en chaîne contenant IP et charges utiles arbitraires.",
        "type": "string",
        "enum": [
          "created",
          "updated",
          "registrations_opened",
          "registrations_closed",
          "participant_registered",
          "participant_waitlisted",
          "participant_promoted",
          "participant_unregistered",
          "participant_removed",
          "participant_disqualified",
          "participant_reinstated",
          "seeding_changed",
          "bracket_generated",
          "tournament_started",
          "score_reported",
          "score_validated",
          "phase_advanced",
          "organizer_added",
          "organizer_removed",
          "tournament_closed",
          "tournament_canceled",
          "tournament_restored"
        ],
        "x-enum-varnames": [
          "CREATED",
          "UPDATED",
          "REGISTRATIONS_OPENED",
          "REGISTRATIONS_CLOSED",
          "PARTICIPANT_REGISTERED",
          "PARTICIPANT_WAITLISTED",
          "PARTICIPANT_PROMOTED",
          "PARTICIPANT_UNREGISTERED",
          "PARTICIPANT_REMOVED",
          "PARTICIPANT_DISQUALIFIED",
          "PARTICIPANT_REINSTATED",
          "SEEDING_CHANGED",
          "BRACKET_GENERATED",
          "TOURNAMENT_STARTED",
          "SCORE_REPORTED",
          "SCORE_VALIDATED",
          "PHASE_ADVANCED",
          "ORGANIZER_ADDED",
          "ORGANIZER_REMOVED",
          "TOURNAMENT_CLOSED",
          "TOURNAMENT_CANCELED",
          "TOURNAMENT_RESTORED"
        ]
      },
      "TournamentListItem": {
        "description": "Projection compacte de la liste publique `/tournaments`.",
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "type": {
            "type": "string"
          },
          "status": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          }
        },
        "required": [
          "id",
          "name",
          "description",
          "type",
          "status",
          "createdAt",
          "updatedAt"
        ]
      },
      "TournamentMatchStats": {
        "type": "object",
        "properties": {
          "matches": {
            "type": "number"
          },
          "totalGoals": {
            "type": "number"
          },
          "avgGoals": {
            "type": "number"
          },
          "topScore": {
            "type": "number"
          },
          "minMargin": {
            "type": "number"
          },
          "maxMargin": {
            "type": "number"
          },
          "biggestBlowout": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/TournamentMatchup"
              },
              {
                "type": "null"
              }
            ]
          },
          "closestMatch": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/TournamentMatchup"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "matches",
          "totalGoals",
          "avgGoals",
          "topScore",
          "minMargin",
          "maxMargin",
          "biggestBlowout",
          "closestMatch"
        ]
      },
      "TournamentMatchup": {
        "type": "object",
        "properties": {
          "winnerDisplayName": {
            "type": "string"
          },
          "winnerAvatar": {
            "type": "string"
          },
          "loserDisplayName": {
            "type": "string"
          },
          "loserAvatar": {
            "type": "string"
          },
          "scoreWinner": {
            "type": "number"
          },
          "scoreLoser": {
            "type": "number"
          }
        },
        "required": [
          "winnerDisplayName",
          "winnerAvatar",
          "loserDisplayName",
          "loserAvatar",
          "scoreWinner",
          "scoreLoser"
        ]
      },
      "TournamentSeries": {
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "logo": {
            "type": "string"
          },
          "organization": {
            "$ref": "#/components/schemas/OrganizationDTO"
          },
          "tournaments": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Tournament"
            }
          }
        },
        "required": [
          "id",
          "name",
          "description",
          "logo",
          "organization",
          "tournaments"
        ]
      },
      "TournamentState": {
        "type": "string",
        "enum": [
          "Pending",
          "Preregistering",
          "Preparing",
          "Ongoing",
          "Finished",
          "Canceled"
        ],
        "x-enum-varnames": [
          "PENDING",
          "PREREGISTERING",
          "PREPARING",
          "ONGOING",
          "FINISHED",
          "CANCELED"
        ]
      },
      "TournamentSummary": {
        "type": "object",
        "properties": {
          "top10": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/TournamentTop10Entry"
            }
          },
          "stats": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/TournamentMatchStats"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "top10",
          "stats"
        ]
      },
      "TournamentTop10Entry": {
        "type": "object",
        "properties": {
          "rank": {
            "type": "number"
          },
          "rankLabel": {
            "type": "string"
          },
          "userId": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatar": {
            "type": "string"
          },
          "clan": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/CircuitClanTag"
              },
              {
                "type": "null"
              }
            ]
          },
          "points": {
            "type": "number",
            "description": "Points de circuit gagnés pour CE tournoi — pas le cumul all-time."
          },
          "tier": {
            "type": "string"
          },
          "goalsScored": {
            "type": "number"
          },
          "goalsConceded": {
            "type": "number"
          },
          "goalAverage": {
            "type": "number"
          }
        },
        "required": [
          "rank",
          "rankLabel",
          "userId",
          "displayName",
          "avatar",
          "clan",
          "points",
          "tier",
          "goalsScored",
          "goalsConceded",
          "goalAverage"
        ]
      },
      "UpdateClanPayload": {
        "description": "Mise à jour partielle d'un clan (PUT /clans/:id).",
        "type": "object",
        "properties": {
          "name": {
            "type": "string"
          },
          "shortenedName": {
            "type": "string"
          },
          "clanBiography": {
            "type": "string"
          },
          "clanAvatarUrl": {
            "type": "string"
          },
          "xUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "instagramUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "tiktokUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "isRecruiting": {
            "type": "boolean"
          },
          "autoAcceptMembers": {
            "type": "boolean"
          },
          "isHidden": {
            "type": "boolean",
            "description": "Masque le clan de l'annuaire public."
          },
          "languages": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "origin": {
            "type": "string"
          },
          "isInactive": {
            "type": "boolean",
            "description": "Bascule « clan inactif » — l'API ne l'accepte que d'un administrateur Achilléa."
          }
        }
      },
      "UpdateUserProfilePayload": {
        "description": "Champs modifiables par le titulaire du profil.",
        "type": "object",
        "properties": {
          "bio": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "twitchUrl": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        }
      },
      "UploadedImage": {
        "description": "`POST /proxy/upload` — image dédupliquée par hash côté API.",
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "url": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "url"
        ]
      },
      "User": {
        "description": "Identité affichable d'un joueur dans un rendu 2D/3D ou un classement.",
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "rank": {
            "$ref": "#/components/schemas/Rank"
          },
          "logo": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "name",
          "rank",
          "logo"
        ]
      },
      "UserClanSummary": {
        "description": "Appartenance de clan résumée, telle qu'embarquée dans un profil enrichi.",
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "shortenedName": {
            "type": "string"
          },
          "name": {
            "type": "string"
          },
          "avatarUrl": {
            "type": "string"
          },
          "role": {
            "$ref": "#/components/schemas/ClanMemberRole"
          },
          "distinctions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/ClanMemberDistinction"
            }
          }
        },
        "required": [
          "id",
          "shortenedName",
          "name",
          "role",
          "distinctions"
        ]
      },
      "UserDTO": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "type": {
            "type": "string",
            "description": "Discriminant d'entité, présent sur les fiches publiques et absent de la\nsession : optionnel pour que `SessionUserDTO` reste assignable."
          },
          "username": {
            "type": "string"
          },
          "rgProfileUsername": {
            "type": "string",
            "description": "Canonical Rose Griffon public profile slug when the Discord account is linked."
          },
          "sim": {
            "type": "number",
            "description": "Champs présents uniquement sur la session de l'utilisateur courant.\n\n`GET /clans` imbrique un président réduit (identité et profil public) qui\nne les porte pas. Les exiger faisait échouer la validation de la réponse\nENTIÈRE, donc de tous les clans."
          },
          "avatar": {
            "type": "string"
          },
          "clanId": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "description": "L'API historique sérialise l'absence de clan en `null` (et non en champ\nabsent). Les deux formes sont donc recevables dans le contrat partagé."
          },
          "soloRank": {
            "$ref": "#/components/schemas/RankDTO"
          },
          "duoRank": {
            "$ref": "#/components/schemas/RankDTO"
          },
          "lastInteract": {
            "type": "string",
            "format": "date-time"
          },
          "role": {
            "$ref": "#/components/schemas/UserRole"
          },
          "currentLevel": {
            "type": "number"
          },
          "totalXp": {
            "type": "number"
          },
          "hasTwitch": {
            "type": "boolean"
          },
          "hasChallonge": {
            "type": "boolean"
          },
          "hasYoutube": {
            "type": "boolean"
          }
        },
        "required": [
          "id",
          "username"
        ]
      },
      "UserRef": {
        "description": "Vue minimale d'un utilisateur (avatar + libellé), suffisante pour une liste.",
        "type": "object",
        "properties": {
          "id": {
            "type": "string"
          },
          "username": {
            "type": "string"
          },
          "displayName": {
            "type": "string"
          },
          "avatar": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "required": [
          "id",
          "username"
        ]
      },
      "UserRole": {
        "type": "number",
        "enum": [
          0,
          1,
          2,
          3
        ],
        "x-enum-varnames": [
          "User",
          "Moderator",
          "Administrator",
          "SuperAdministrator"
        ]
      },
      "UsersAndGuildsResponse": {
        "type": "object",
        "properties": {
          "activeUsers": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/DailyCountRow"
            }
          },
          "users": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/DailyCountRow"
            }
          },
          "guilds": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/DailyCountRow"
            }
          }
        },
        "required": [
          "activeUsers",
          "users",
          "guilds"
        ]
      },
      "WalletBalance": {
        "description": "Portefeuille — un solde par utilisateur dans une devise virtuelle (ex. ACH)\nplus un journal de mouvements.",
        "type": "object",
        "properties": {
          "balance": {
            "type": "number"
          },
          "currency": {
            "type": "string"
          }
        },
        "required": [
          "balance",
          "currency"
        ]
      },
      "WalletHistoryPage": {
        "type": "object",
        "properties": {
          "transactions": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/WalletTransaction"
            }
          },
          "total": {
            "type": "number"
          }
        },
        "required": [
          "transactions"
        ]
      },
      "WalletTransaction": {
        "description": "Une ligne du journal des transactions (`GET /wallet/me/history`).",
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "PostgreSQL UUID of the immutable transaction row."
          },
          "type": {
            "$ref": "#/components/schemas/WalletTransactionType"
          },
          "amount": {
            "type": "number"
          },
          "reason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "direction": {
            "$ref": "#/components/schemas/WalletTransactionDirection"
          },
          "createdAt": {
            "type": "string"
          }
        },
        "required": [
          "id",
          "type",
          "amount",
          "reason",
          "direction",
          "createdAt"
        ]
      },
      "WalletTransactionDirection": {
        "description": "Sens du mouvement vis-à-vis du solde du titulaire.",
        "type": "string",
        "enum": [
          "in",
          "out"
        ],
        "x-enum-varnames": [
          "In",
          "Out"
        ]
      },
      "WalletTransactionType": {
        "description": "Type de mouvement du portefeuille (doit matcher l'enum côté bot).",
        "type": "string",
        "enum": [
          "Credit",
          "Debit",
          "Transfer",
          "Payout",
          "Fine"
        ],
        "x-enum-varnames": [
          "Credit",
          "Debit",
          "Transfer",
          "Payout",
          "Fine"
        ]
      },
      "WireParticipant": {
        "description": "`ParticipantDTO` tel qu'il circule (le tournoi n'est souvent qu'un id).",
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "user": {
            "$ref": "#/components/schemas/UserDTO"
          },
          "bracketParticipantId": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "seed": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "hasCheckedIn": {
            "type": "boolean"
          },
          "status": {
            "$ref": "#/components/schemas/ParticipantStatus",
            "description": "Absent sur les réponses d'API antérieures au statut : traiter comme `ACTIVE`."
          },
          "registeredAt": {
            "type": "string"
          },
          "waitlistPosition": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ],
            "description": "Rang dans la liste d'attente (1 = prochain promu)."
          },
          "statusReason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Motif de DQ — renseigné uniquement pour les organisateurs."
          },
          "tournament": {
            "$ref": "#/components/schemas/EntityRef"
          }
        },
        "required": [
          "id",
          "user",
          "hasCheckedIn",
          "tournament"
        ]
      },
      "WireTournament": {
        "description": "`Tournament` tel qu'il circule (relations éventuellement réduites à un id).",
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "type": {
            "$ref": "#/components/schemas/EventTypeEnum"
          },
          "createdAt": {
            "type": "string",
            "format": "date-time"
          },
          "updatedAt": {
            "type": "string",
            "format": "date-time"
          },
          "internalState": {
            "$ref": "#/components/schemas/TournamentState"
          },
          "startsAt": {
            "type": "string",
            "format": "date-time"
          },
          "grandFinalAt": {
            "type": "string",
            "format": "date-time"
          },
          "tournamentType": {
            "$ref": "#/components/schemas/StageType"
          },
          "participantsNumber": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "seedOrdering": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/SeedOrdering"
              },
              {
                "type": "null"
              }
            ]
          },
          "matchFormat": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/MatchFormat"
              },
              {
                "type": "null"
              }
            ]
          },
          "customFormatChildCount": {
            "anyOf": [
              {
                "type": "number"
              },
              {
                "type": "null"
              }
            ]
          },
          "groupStageEnabled": {
            "type": "boolean"
          },
          "groupStageType": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/StageType"
              },
              {
                "type": "null"
              }
            ]
          },
          "logo": {
            "type": "string"
          },
          "affiche": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "planning": {
            "type": "string"
          },
          "ruleset": {
            "type": "string"
          },
          "placementEloApplied": {
            "type": "boolean",
            "description": "True une fois le bonus AP podium (top 4) versé.\nAbsent / false tant que non appliqué (tournois en cours ou formats hors scope)."
          },
          "registrationOpensAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Planning automatisé (voir `docs/plan-tournois.md`)."
          },
          "registrationClosesAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "autoStart": {
            "type": "boolean"
          },
          "discordRoleEnabled": {
            "type": "boolean"
          },
          "scoreReportPolicy": {
            "$ref": "#/components/schemas/ScoreReportPolicy",
            "description": "Qui saisit les scores (absent sur un tournoi d'avant l'option = joueurs)."
          },
          "discordRoleId": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Rôle Discord attribué aux inscrits, créé à l'ouverture des inscriptions."
          },
          "cancelReason": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Renseignés quand le tournoi a été annulé (l'entité reste en base)."
          },
          "canceledAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ]
          },
          "closedAt": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Horodatage d'une clôture manuelle (null si passage automatique en Terminé)."
          },
          "series": {
            "anyOf": [
              {
                "$ref": "#/components/schemas/EntityRef"
              },
              {
                "type": "null"
              }
            ]
          },
          "organization": {
            "$ref": "#/components/schemas/EntityRef"
          },
          "managers": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/EntityRef"
            },
            "description": "Relations OPTIONNELLES sur la liste.\n\n`GET /tournaments` ne les peuple pas — seul `GET /tournaments/:id` le\nfait. Les exiger faisait rejeter les 9 tournois de la liste et affichait\n« Aucun tournoi trouvé » sur une API qui en servait neuf."
          },
          "participants": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/EntityRef"
            }
          }
        },
        "required": [
          "id",
          "name",
          "description",
          "type",
          "createdAt",
          "updatedAt",
          "internalState",
          "startsAt",
          "grandFinalAt",
          "tournamentType",
          "groupStageEnabled",
          "logo",
          "planning",
          "ruleset",
          "organization"
        ]
      },
      "WireTournamentSeries": {
        "description": "`TournamentSeries` sans sa récursion de tournois peuplés.",
        "type": "object",
        "properties": {
          "id": {
            "type": "number"
          },
          "name": {
            "type": "string"
          },
          "description": {
            "type": "string"
          },
          "logo": {
            "type": "string"
          },
          "organization": {
            "$ref": "#/components/schemas/EntityRef"
          },
          "tournaments": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/EntityRef"
            }
          }
        },
        "required": [
          "id",
          "name",
          "description",
          "logo",
          "organization"
        ]
      },
      "Character": {
        "type": "object",
        "title": "Character",
        "description": "Canonical Inazuma Eleven: Victory Road character entity.",
        "properties": {
          "charaId": {
            "type": "string",
            "description": "Unique character ID (e.g. 'c01000010')"
          },
          "name": {
            "type": "string",
            "description": "Localized display name"
          },
          "element": {
            "type": "integer",
            "description": "Element ID (1=Wind, 2=Wood, 3=Fire, 4=Earth)"
          },
          "position": {
            "type": "integer",
            "description": "Position ID (1=GK, 2=DF, 3=MF, 4=FW)"
          },
          "rarity": {
            "type": "integer",
            "description": "Base rarity tier (1 to 5)"
          },
          "kick": {
            "type": "integer"
          },
          "dribble": {
            "type": "integer"
          },
          "block": {
            "type": "integer"
          },
          "catch": {
            "type": "integer"
          },
          "speed": {
            "type": "integer"
          },
          "technique": {
            "type": "integer"
          },
          "stamina": {
            "type": "integer"
          },
          "lucky": {
            "type": "integer"
          }
        },
        "required": [
          "charaId",
          "name",
          "element",
          "position",
          "rarity"
        ]
      },
      "Skill": {
        "type": "object",
        "title": "Skill",
        "description": "Canonical special move (Hissatsu) or passive skill.",
        "properties": {
          "skillId": {
            "type": "string",
            "description": "Skill identifier"
          },
          "name": {
            "type": "string",
            "description": "Localized skill name"
          },
          "element": {
            "type": "integer",
            "description": "Element affinity"
          },
          "tpCost": {
            "type": "integer",
            "description": "Tension point cost"
          },
          "power": {
            "type": "integer",
            "description": "Base move power rating"
          },
          "category": {
            "type": "string",
            "description": "Category (Shoot, Dribble, Block, Catch)"
          }
        },
        "required": [
          "skillId",
          "name",
          "element",
          "tpCost",
          "power"
        ]
      },
      "VfsFormatDescriptor": {
        "type": "object",
        "title": "VfsFormatDescriptor",
        "description": "Binary file format descriptor recognized by IECODE and NIE.",
        "properties": {
          "id": {
            "type": "integer",
            "description": "Internal format identifier"
          },
          "magicHex": {
            "type": "string",
            "description": "4-byte magic number in hexadecimal (e.g. '0x58543447')"
          },
          "magicAscii": {
            "type": "string",
            "description": "ASCII representation of the magic header (e.g. 'G4TX')"
          },
          "extension": {
            "type": "string",
            "description": "Canonical file extension (e.g. '.g4tx')"
          },
          "description": {
            "type": "string",
            "description": "Human-readable format explanation"
          },
          "isBigEndian": {
            "type": "boolean",
            "description": "True if byte order is big-endian"
          },
          "category": {
            "type": "string",
            "enum": [
              "texture",
              "model",
              "config",
              "audio",
              "video",
              "container",
              "script",
              "system"
            ]
          },
          "encryptionSupported": {
            "type": "boolean",
            "description": "True if format supports encryption"
          },
          "compressionSupported": {
            "type": "boolean",
            "description": "True if format supports CRILAYLA or LZSS compression"
          }
        },
        "required": [
          "id",
          "magicHex",
          "magicAscii",
          "extension",
          "description",
          "category"
        ]
      },
      "VfsPackRule": {
        "type": "object",
        "title": "VfsPackRule",
        "description": "CRI CPK pack file mapping rule in the Victory Road VFS.",
        "properties": {
          "packName": {
            "type": "string",
            "description": "Target CPK archive filename"
          },
          "filenameMask": {
            "type": "string",
            "description": "Wildcard mask matching input files"
          },
          "keyDerivation": {
            "type": "string",
            "enum": [
              "filename-crc32",
              "viola-fixed",
              "none"
            ]
          },
          "mountPriority": {
            "type": "integer",
            "description": "Mount priority order (higher numbers resolve first)"
          },
          "description": {
            "type": "string",
            "description": "Purpose and content of this pack"
          },
          "isCompressed": {
            "type": "boolean",
            "description": "Whether contained streams use CRILAYLA compression"
          }
        },
        "required": [
          "packName",
          "filenameMask",
          "keyDerivation",
          "mountPriority"
        ]
      },
      "NieCryptoConstant": {
        "type": "object",
        "title": "NieCryptoConstant",
        "description": "Cryptographic constant reverse-engineered from nie.exe.",
        "properties": {
          "name": {
            "type": "string"
          },
          "hexValue": {
            "type": "string"
          },
          "intValue": {
            "type": "number"
          },
          "usage": {
            "type": "string"
          },
          "verifiedInGameDump": {
            "type": "boolean"
          }
        },
        "required": [
          "name",
          "hexValue",
          "usage",
          "verifiedInGameDump"
        ]
      },
      "NieMemoryOffset": {
        "type": "object",
        "title": "NieMemoryOffset",
        "description": "Disassembled function entry point or memory address in nie.exe.",
        "properties": {
          "symbol": {
            "type": "string"
          },
          "addressHex": {
            "type": "string"
          },
          "subsystem": {
            "type": "string",
            "enum": [
              "game-loop",
              "controller",
              "render",
              "vfs",
              "audio",
              "crypto",
              "prng",
              "lua"
            ]
          },
          "description": {
            "type": "string"
          },
          "callingConvention": {
            "type": "string"
          },
          "signature": {
            "type": "string"
          }
        },
        "required": [
          "symbol",
          "addressHex",
          "subsystem",
          "description"
        ]
      },
      "NieRttiClass": {
        "type": "object",
        "title": "NieRttiClass",
        "description": "Reconstructed MSVC RTTI polymorphic class in nie.exe.",
        "properties": {
          "name": {
            "type": "string"
          },
          "namespace": {
            "type": "string"
          },
          "vtableOffsetHex": {
            "type": "string"
          },
          "baseClasses": {
            "type": "array",
            "items": {
              "type": "string"
            }
          },
          "description": {
            "type": "string"
          }
        },
        "required": [
          "name",
          "namespace",
          "vtableOffsetHex",
          "baseClasses",
          "description"
        ]
      }
    },
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Jeton JWT Achilléa ou Bearer secret cron/admin"
      },
      "cookieSession": {
        "type": "apiKey",
        "in": "cookie",
        "name": "better-auth.session_token",
        "description": "Cookie de session Better Auth (.rosegriffon.fr)"
      }
    }
  }
} as const;
export type MonorepoOpenApi = typeof MONOREPO_OPENAPI;
