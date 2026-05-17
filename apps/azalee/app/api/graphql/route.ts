import { useGraphQlJit } from "@envelop/graphql-jit";
import { useResponseCache } from "@graphql-yoga/plugin-response-cache";
import { createSchema, createYoga } from "graphql-yoga";
import { wikiService } from "@/lib/wiki-service";

const typeDefs = `
  scalar JSON

  type LocalizedString {
    fr: String
    en: String
    ja: String
  }

  type Stats {
    kick: Int
    control: Int
    technique: Int
    pressure: Int
    physical: Int
    agility: Int
    intelligence: Int
  }

  type CharacterVariant {
    charaParamId: ID!
    position: String
    element: String
    rarity: String
    stats: Stats
    image: String
  }

  type Character {
    id: ID!
    internalCode: String
    name: LocalizedString
    gender: Int
    image: String
    variants: [CharacterVariant]
    sheetData: JSON
  }

  type Item {
    id: ID!
    name: LocalizedString
    description: String
    category: String
    rarity: Int
    image: String
    sheetData: JSON
  }

  type Skill {
    id: ID!
    name: LocalizedString
    description: String
    category: String
    element: String
    power: String
    tension: Int
    image: String
    sheetData: JSON
  }

  type Aura {
    id: ID!
    name: String
    passive: String
    hissatsu: String
    element: String
    image: String
    type: String
    sheetData: JSON
  }

  type Query {
    characters(page: Int, limit: Int, q: String, element: String, position: String, rarity: String, team: String, series: String): [Character]
    character(id: ID!): Character
    items(page: Int, limit: Int, q: String, category: String): [Item]
    item(id: ID!): Item
    skills(page: Int, limit: Int, q: String, category: String, element: String): [Skill]
    skill(id: ID!): Skill
    auras(page: Int, limit: Int, q: String, element: String, typeSlug: String!): [Aura]
  }
`;

const resolvers = {
  Query: {
    characters: async (_: any, args: any) => {
      const { data } = await wikiService.getCharactersList(args);
      return data.map((c: any) => ({
        id: c.charaId,
        internalCode: c.internalCode,
        name: c.names,
        gender: c.gender,
        image: c.image,
        variants: c.variants.map((v: any) => ({
          charaParamId: v.charaParamId,
          position: v.position,
          element: v.element,
          rarity: v.rarity,
          stats: v.stats?.lv99 || v.stats,
          image: v.image,
        })),
        sheetData: c.sheetData,
      }));
    },
    character: async (_: any, { id }: any) => {
      const c = await wikiService.getCharacter(id);
      if (!c) return null;
      return {
        id: c.charaId,
        internalCode: c.internalCode,
        name: c.names,
        gender: c.gender,
        image: c.image,
        variants: c.variants.map((v: any) => ({
          charaParamId: v.charaParamId,
          position: v.position,
          element: v.element,
          rarity: v.rarity,
          stats: v.stats?.lv99 || v.stats,
          image: v.image,
        })),
        sheetData: c.sheetData,
      };
    },
    items: async (_: any, args: any) => {
      const { data } = await wikiService.getItemsList(args);
      return data.map((i: any) => ({
        id: i.itemId,
        name: i.names,
        description: i.description,
        category: i.category,
        rarity: i.rarity,
        image: i.image,
        sheetData: i.sheetData,
      }));
    },
    item: async (_: any, { id }: any) => {
      const i: any = await wikiService.getItem(id);
      if (!i) return null;
      return {
        id: i.itemId,
        name: i.names,
        description: i.description,
        category: i.category,
        rarity: i.rarity,
        image: i.image,
        sheetData: i.sheetData,
      };
    },
    skills: async (_: any, args: any) => {
      const { data } = await wikiService.getSkillsList(args);
      return data.map((s: any) => ({
        id: s.skillId,
        name: s.names,
        description: s.descriptions?.fr || "",
        category: s.categoryName?.fr || "Unknown",
        element: s.elementName?.fr || "Unknown",
        power: `${s.power_min}-${s.power_max}`,
        tension: s.consumeTp,
        image: s.image,
        sheetData: s.sheetData,
      }));
    },
    skill: async (_: any, { id }: any) => {
      const s: any = await wikiService.getSkill(id);
      if (!s) return null;
      return {
        id: s.skillId,
        name: s.names,
        description: s.descriptions?.fr || "",
        category: s.categoryName?.fr || "Unknown",
        element: s.elementName?.fr || "Unknown",
        power: `${s.power_min}-${s.power_max}`,
        tension: s.consumeTp,
        image: s.image,
        sheetData: s.sheetData,
      };
    },
    auras: async (_: any, args: any) => {
      const { data } = await wikiService.getAurasList(args);
      return data.map((a: any) => ({
        id: a.id,
        name: a.name,
        passive: a.passive,
        hissatsu: a.hissatsu_name,
        element: a.element,
        image: a.image_url,
        type: a.type,
        sheetData: a.sheet_data || a.sheetData,
      }));
    },
  },
};

const { handleRequest } = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
  /* eslint-disable react-hooks/rules-of-hooks -- GraphQL Yoga plugins, not React hooks */
  plugins: [
    useGraphQlJit(),
    useResponseCache({
      session: () => null, // Global cache
      ttl: 900000, // 15 minutes
    }),
  ],
  /* eslint-enable react-hooks/rules-of-hooks */
});

export const GET = (request: Request) => handleRequest(request, {});
export const POST = (request: Request) => handleRequest(request, {});
export const OPTIONS = (request: Request) => handleRequest(request, {});
