/**
 * IR → OpenAPI Specification 3.2.1 (`https://spec.openapis.org/oas/v3.2.1.html`).
 *
 * Réutilise intégralement `emitJsonSchema` pour les 159+ schémas du domaine
 * `@rosegriffon/achillea-types` sans aucune duplication de traduction IR.
 */

import { emitJsonSchema } from "./emit-json-schema";
import type { IrContract } from "./ir";

export const ACHILLEA_OPENAPI_VERSION = "3.2.1";
export const ACHILLEA_JSON_SCHEMA_DIALECT =
  "https://spec.openapis.org/oas/3.2/dialect/2025-09-19";

export interface AchilleaOpenApiDocument {
  openapi: string;
  $self: string;
  jsonSchemaDialect: string;
  info: {
    title: string;
    version: string;
    summary: string;
    description: string;
    license: { name: string };
  };
  servers: Array<{ url: string; description: string }>;
  tags: Array<{
    name: string;
    summary: string;
    parent?: string;
    kind?: string;
  }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
}

function rewriteDefsToComponents(
  defs: Record<string, unknown>,
): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(defs).replaceAll("#/$defs/", "#/components/schemas/"),
  ) as Record<string, unknown>;
}

const schemaRef = (name: string) => ({
  $ref: `#/components/schemas/${name}`,
});

const jsonResponse = (description: string, schema: Record<string, unknown>) => ({
  description,
  content: { "application/json": { schema } },
});

export function emitOpenApi(contract: IrContract): AchilleaOpenApiDocument {
  const { $defs } = emitJsonSchema(contract);
  const schemas = rewriteDefsToComponents($defs);

  return {
    openapi: ACHILLEA_OPENAPI_VERSION,
    $self: "https://achillea.rosegriffon.fr/contract/achillea.openapi.json",
    jsonSchemaDialect: ACHILLEA_JSON_SCHEMA_DIALECT,
    info: {
      title: "Achilléa & Ranked Domain API",
      version: contract.version,
      summary: "Contrat OpenAPI 3.2.1 généré depuis @rosegriffon/achillea-types",
      description: `Source canonique ${contract.source}@${contract.version} — schémas du domaine compétitif Achilléa et Ranked.`,
      license: { name: "Apache-2.0" },
    },
    servers: [
      {
        url: "https://api.rosegriffon.fr/v1",
        description: "Unified Rose Griffon API",
      },
      {
        url: "https://ranked.rosegriffon.fr",
        description: "Achilléa Ranked HTTP/WebSocket Server",
      },
    ],
    tags: [
      {
        name: "achillea",
        summary: "Tournois, circuits, profils compétitifs et sanctions",
        kind: "domain",
      },
      {
        name: "tournaments",
        summary: "Tournois et arbres compétitifs Achilléa",
        parent: "achillea",
        kind: "resource",
      },
      {
        name: "ranked",
        summary: "Défis, lobbies et saisons classées",
        parent: "achillea",
        kind: "resource",
      },
    ],
    paths: {
      "/tournaments": {
        get: {
          tags: ["tournaments"],
          operationId: "listTournaments",
          summary: "Lister les tournois Achilléa",
          responses: {
            "200": jsonResponse("Liste des tournois", {
              type: "array",
              items: schemas.Tournament
                ? schemaRef("Tournament")
                : { type: "object" },
            }),
          },
        },
      },
      "/tournaments/circuit/ranking": {
        get: {
          tags: ["tournaments"],
          operationId: "getCircuitRanking",
          summary: "Classement du circuit compétitif",
          responses: {
            "200": jsonResponse("Classement circuit", { type: "object" }),
          },
        },
      },
      "/tournaments/{id}/summary": {
        get: {
          tags: ["tournaments"],
          operationId: "getTournamentSummary",
          summary: "Résumé d'un tournoi",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": jsonResponse("Résumé du tournoi", { type: "object" }),
          },
        },
      },
      "/users/me": {
        get: {
          tags: ["achillea"],
          operationId: "getAchilleaMe",
          summary: "Profil compétitif courant",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": jsonResponse("Profil utilisateur", { type: "object" }),
          },
        },
      },
      "/api/ranked/challenge": {
        post: {
          tags: ["ranked"],
          operationId: "createRankedChallenge",
          summary: "Créer un défi classé",
          security: [{ bearerAuth: [] }],
          responses: {
            "201": jsonResponse("Défi créé", { type: "object" }),
          },
        },
      },
      "/api/ranked/challenge/{code}": {
        get: {
          tags: ["ranked"],
          operationId: "getRankedChallenge",
          summary: "Lire l'état d'un défi classé",
          parameters: [
            {
              name: "code",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": jsonResponse("État du défi", { type: "object" }),
          },
        },
      },
    },
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  };
}
