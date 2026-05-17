"use server";

import { isKana, toKatakana } from "wanakana";
import {
  getAuraImageUrl,
  getCharacterFaceUrl,
  getEmblemImageUrl,
  getItemImageUrl,
  getSkillImageUrl,
  resolveAssetUrl,
} from "@/lib/images";
import {
  type GlobalSearchResult,
  type SearchContext,
  smartSearch,
} from "@/lib/search/smart-search";
import { createClient } from "@/lib/supabase/server";
import { TACTIC_FR, translateEffect } from "@/lib/translations";

const TYPE_CONFIG: Record<string, { label: string; icon: string; urlPrefix: string }> = {
  basara: { label: "Joueur BASARA", icon: "person", urlPrefix: "/chara" },
  character: { label: "Personnage", icon: "person_outline", urlPrefix: "/chara" },
  skill: { label: "Technique", icon: "sports_soccer", urlPrefix: "/skill" },
  item: { label: "Objet", icon: "inventory_2", urlPrefix: "/item" },
  keshin: { label: "Esprit Guerrier", icon: "auto_awesome", urlPrefix: "/aura/esprits-guerriers" },
  soul: { label: "Totem", icon: "auto_awesome", urlPrefix: "/aura/totems" },
  miximax: { label: "Miximax", icon: "auto_awesome", urlPrefix: "/aura/miximax" },
  awakening: { label: "Éveil", icon: "auto_awesome", urlPrefix: "/aura/eveil" },
  modechange: {
    label: "Changement Mode",
    icon: "auto_awesome",
    urlPrefix: "/aura/changement-mode",
  },
  aura: { label: "Aura", icon: "auto_awesome", urlPrefix: "/aura/autres" },
  tactic: { label: "Tactique", icon: "schema", urlPrefix: "/tactic" },
  article: { label: "Actualité", icon: "newspaper", urlPrefix: "/news" },
  patchnote: { label: "Patch Note", icon: "update", urlPrefix: "/patch-notes" },
};

/** Enhanced search result for frontend */
export interface EnhancedSearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: string;
  url: string;
  matchedLanguage?: "FR" | "EN" | "JP";
  matchedName?: string;
  suggestion?: string;
  score: number;
  imageUrl?: string;
  rarity?: string;
  element?: string;
  position?: string;
}

/** Aura table definition for search */
const AURA_TABLES = [
  { table: "inagle_keshins_clean", type: "keshin" },
  { table: "inagle_souls_clean", type: "soul" },
  { table: "inagle_miximax_clean", type: "miximax" },
  { table: "inagle_awakenings_clean", type: "awakening" },
  { table: "inagle_mode_changes_clean", type: "modechange" },
  { table: "inagle_auras", type: "aura" },
] as const;

/**
 * Smart global search with context awareness and language detection
 */
export async function searchGlobal(
  query: string,
  context?: SearchContext,
): Promise<EnhancedSearchResult[]> {
  if (!query || query.length < 2) return [];

  const supabase = await createClient();
  // Sanitize query to prevent PostgREST filter injection
  const sanitized = query.replaceAll(/[%_,().*\\]/g, "");
  const q = `%${sanitized}%`;

  // Try converting romaji input to katakana for Japanese name search
  let orFilter = `name_fr.ilike.${q},name_en.ilike.${q},name_ja.ilike.${q}`;
  const kataCandidate = toKatakana(sanitized.toLowerCase());
  const isValidKana =
    kataCandidate.length > 0 && [...kataCandidate].every((c) => isKana(c) || c === "ー");
  if (isValidKana && kataCandidate !== sanitized) {
    const qKana = `%${kataCandidate}%`;
    orFilter = `name_fr.ilike.${q},name_en.ilike.${q},name_ja.ilike.${q},name_ja.ilike.${qKana}`;
  }

  // Build character query with romaji/katakana support
  const charQuery = (supabase as any)
    .from("inagle_characters")
    .select(
      "id, slug, name_fr, name_en, name_ja, position, element, rarity_label, gender, internal_code, zukan_hash, stat_frappe, sheet_data",
    )
    .or(orFilter)
    .order("zukan_hash", { ascending: false, nullsFirst: false })
    .order("stat_frappe", { ascending: false, nullsFirst: false })
    .limit(15);

  // Parallel search across ALL tables
  const [chars, skills, items, ...auraResults] = await Promise.all([
    // Characters: include enrichment fields for scoring & display
    charQuery,
    // Skills: include image/video fields
    (supabase as any)
      .from("inagle_skills")
      .select(
        "id, name_fr, name_en, name_ja, image_url, video_url, element_id, category_id, power_min, power_max, sheet_data",
      )
      .or(orFilter)
      .order("video_url", { ascending: false, nullsFirst: false })
      .limit(10),
    // Items: include image/price
    (supabase as any)
      .from("inagle_items")
      .select("id, name_fr, name_en, name_ja, image_url, category, price, sheet_data")
      .or(orFilter)
      .limit(10),
    // All aura tables
    ...AURA_TABLES.map(({ table }) =>
      (supabase as any)
        .from(table)
        .select("id, name_fr, name_en, name_ja, sub_type, asset_code, image_url")
        .or(orFilter)
        .limit(5),
    ),
  ]);

  // Separate queries for non-game content (teams, articles, patch notes)
  const [teams, articles, patchNotes] = await Promise.all([
    (supabase as any)
      .from("inagle_teams")
      .select("id, name_fr, name_en, name_ja, sheet_data")
      .or(orFilter)
      .limit(8),
    (supabase as any)
      .from("articles")
      .select("id, title, slug, excerpt, category")
      .eq("status", "published")
      .eq("app", "azalee")
      .ilike("title", q)
      .limit(5),
    (supabase as any)
      .from("patch_notes")
      .select("id, title, title_fr, date, platform")
      .or(`title.ilike.${q},title_fr.ilike.${q}`)
      .limit(5),
  ]);

  const rawResults: GlobalSearchResult[] = [];

  // ─── Relevance scoring helper ─────────────────────────────────────
  // Boost results whose name starts with or exactly matches the query
  const queryLower = sanitized.toLowerCase();
  function matchRelevance(names: Array<string | null | undefined>): number {
    let best = 0;
    for (const raw of names) {
      if (!raw) continue;
      const n = raw.toLowerCase();
      if (n === queryLower) return 3; // exact match
      if (n.startsWith(queryLower)) best = Math.max(best, 2); // prefix match
      // word-start match (e.g. "mark" in "Endo Mark")
      if (best < 1.5 && n.split(/[\s_-]/).some((w) => w.startsWith(queryLower)))
        best = Math.max(best, 1.5);
    }
    return best;
  }

  // Characters — boost enriched (has image, has stats, has sheet_data)
  if (chars.data) {
    chars.data.forEach((c: any) => {
      let score = 1;
      score += matchRelevance([c.name_fr, c.name_en, c.name_ja]);
      if (c.zukan_hash) score += 0.3; // has official image
      if (c.stat_frappe) score += 0.2; // has stats
      if (c.sheet_data) score += 0.1; // has community data
      const isBasara = c.rarity_label === "BASARA";
      if (isBasara) score += 0.2; // BASARA priority
      rawResults.push({
        id: c.slug || c.id,
        type: isBasara ? "basara" : "character",
        name: c.name_fr || c.name_en,
        score,
        data: c,
      });
    });
  }

  // Skills — boost those with video
  if (skills.data) {
    skills.data.forEach((s: any) => {
      let score = 1;
      score += matchRelevance([s.name_fr, s.name_en, s.name_ja]);
      if (s.video_url) score += 0.2;
      if (s.sheet_data) score += 0.1;
      rawResults.push({
        id: s.id,
        type: "skill",
        name: s.name_fr || s.name_en,
        score,
        data: s,
      });
    });
  }

  // Items — boost those with sheet_data/price, discriminate tactics
  if (items.data) {
    items.data.forEach((i: any) => {
      let score = 1;
      score += matchRelevance([i.name_fr, i.name_en, i.name_ja]);
      if (i.sheet_data) score += 0.1;
      if (i.price) score += 0.1;
      const isTactic = i.category === "special_tactics";
      rawResults.push({
        id: i.id,
        type: isTactic ? "tactic" : "item",
        name: i.name_fr || i.name_en,
        score,
        data: i,
      });
    });
  }

  // Auras (all categories)
  auraResults.forEach((result, index) => {
    const { type: auraType } = AURA_TABLES[index];
    if (result.data) {
      result.data.forEach((a: any) => {
        let score = 0.9;
        score += matchRelevance([a.name_fr, a.name_en, a.name_ja]);
        rawResults.push({
          id: a.id,
          type: auraType,
          name: a.name_fr || a.name_en || a.name_ja || a.id,
          score,
          data: a,
        });
      });
    }
  });

  // Teams
  if (teams.data) {
    teams.data.forEach((t: any) => {
      let score = 0.8;
      score += matchRelevance([t.name_fr, t.name_en, t.name_ja]);
      if (t.sheet_data) score += 0.1;
      rawResults.push({
        id: t.id,
        type: "team",
        name: t.name_fr || t.name_en || t.name_ja,
        score,
        data: t,
      });
    });
  }

  // Articles
  if (articles.data) {
    articles.data.forEach((a: any) => {
      let score = 0.7;
      score += matchRelevance([a.title]);
      rawResults.push({
        id: a.slug || a.id,
        type: "article",
        name: a.title,
        score,
        data: a,
      });
    });
  }

  // Patch Notes — also search title_fr
  if (patchNotes.data) {
    patchNotes.data.forEach((p: any) => {
      let score = 0.6;
      score += matchRelevance([p.title, p.title_fr]);
      rawResults.push({
        id: p.id,
        type: "patchnote",
        name: p.title_fr || p.title,
        score,
        data: p,
      });
    });
  }

  // Apply smart search enhancements
  const smartResults = await smartSearch(query, rawResults, {
    context: context || "global",
    limit: 20,
    enableSuggestions: true,
    minScore: 0,
  });

  // Handle "did you mean?" suggestion case
  if (smartResults.length === 1 && smartResults[0].suggestion) {
    return [
      {
        id: "suggestion",
        type: "suggestion",
        title: smartResults[0].suggestion,
        subtitle: "Vouliez-vous dire...",
        icon: "search",
        url: "#",
        suggestion: smartResults[0].suggestion,
        score: 0,
      },
    ];
  }

  // Transform for frontend consumption with image/rarity/element/position
  return smartResults.map((r) => {
    const config = TYPE_CONFIG[r.type] || { label: "Autre", icon: "help", urlPrefix: "#" };
    const d = (r.data || {}) as Record<string, any>;

    let url: string;
    if (config.urlPrefix !== "#") {
      url = `${config.urlPrefix}/${r.id}`;
    } else {
      url = "#";
    }

    // Resolve image URL per type
    let imageUrl: string | undefined;
    let rarity: string | undefined;
    let element: string | undefined;
    let position: string | undefined;

    if (r.type === "character" || r.type === "basara") {
      imageUrl = getCharacterFaceUrl(d.internal_code || d.id);
      rarity = d.rarity_label;
      element = d.element;
      position = d.position;
    } else if (r.type === "skill") {
      imageUrl = d.image_url || getSkillImageUrl(d.id);
    } else if (r.type === "item" || r.type === "tactic") {
      imageUrl = d.image_url || getItemImageUrl(d.id);
    } else if (["keshin", "soul", "miximax", "awakening", "modechange", "aura"].includes(r.type)) {
      imageUrl = getAuraImageUrl(d.asset_code) || undefined;
    } else if (r.type === "team") {
      const emblemId = d.sheet_data?.binderTeamOrderType || d.sheet_data?.emblem;
      if (emblemId) imageUrl = getEmblemImageUrl(emblemId) || undefined;
    }

    return {
      id: r.id,
      type: r.type,
      title: r.matchedName || r.name,
      subtitle: config.label,
      icon: config.icon,
      url,
      matchedLanguage: r.matchedLanguage,
      matchedName: r.matchedName,
      score: r.score,
      imageUrl: imageUrl || undefined,
      rarity,
      element,
      position,
    };
  });
}

export interface CompareSearchResult {
  slug: string;
  name: string;
  element?: string;
  position?: string;
  rarity?: string;
  imageUrl?: string;
  zukanHash?: string;
  totalStats: number;
}

/**
 * Search characters for the compare tool — only returns characters with stats.
 * Supports text search, filter-only browse, or both combined.
 */
export async function searchCompareCharacters(
  query: string,
  filters?: { element?: string; position?: string; rarity?: string },
): Promise<CompareSearchResult[]> {
  const hasText = query && query.length >= 2;
  const hasFilters = filters?.element || filters?.position || filters?.rarity;

  // Need at least a text query or an active filter
  if (!hasText && !hasFilters) return [];

  const supabase = await createClient();
  let dbQuery = (supabase as any)
    .from("inagle_characters")
    .select(
      "id, slug, name_fr, name_en, name_ja, position, element, rarity_label, internal_code, zukan_hash, stat_frappe, stat_controle, stat_technique, stat_pression, stat_physique, stat_agilite, stat_intelligence",
    )
    .not("stat_frappe", "is", null);

  // Text search (optional — if no text, we just browse by filters)
  if (hasText) {
    const sanitized = query.replaceAll(/[%_,().*\\]/g, "");
    const q = `%${sanitized}%`;

    let compareOrFilter = `name_fr.ilike.${q},name_en.ilike.${q},name_ja.ilike.${q}`;
    const compareKata = toKatakana(sanitized.toLowerCase());
    const compareValidKana =
      compareKata.length > 0 && [...compareKata].every((c) => isKana(c) || c === "ー");
    if (compareValidKana && compareKata !== sanitized) {
      compareOrFilter = `name_fr.ilike.${q},name_en.ilike.${q},name_ja.ilike.${q},name_ja.ilike.%${compareKata}%`;
    }
    dbQuery = dbQuery.or(compareOrFilter);
  }

  if (filters?.element) {
    dbQuery = dbQuery.eq("element", filters.element);
  }
  if (filters?.position) {
    dbQuery = dbQuery.eq("position", filters.position);
  }
  if (filters?.rarity) {
    if (filters.rarity === "BASARA") {
      dbQuery = dbQuery.eq("rarity_label", "BASARA");
    } else if (filters.rarity === "10") {
      dbQuery = dbQuery.eq("rarity_label", "Héros");
    } else if (filters.rarity === "1") {
      dbQuery = dbQuery.eq("rarity_label", "Normal");
    }
  }

  const { data } = await dbQuery
    .order("stat_frappe", { ascending: false, nullsFirst: false })
    .limit(30);

  if (!data) return [];

  return (data as any[]).map((c) => {
    const total =
      (c.stat_frappe || 0) +
      (c.stat_controle || 0) +
      (c.stat_technique || 0) +
      (c.stat_pression || 0) +
      (c.stat_physique || 0) +
      (c.stat_agilite || 0) +
      (c.stat_intelligence || 0);
    return {
      slug: c.slug || c.id,
      name: c.name_fr || c.name_en || c.id,
      element: c.element || undefined,
      position: c.position || undefined,
      rarity: c.rarity_label || undefined,
      imageUrl: getCharacterFaceUrl(c.internal_code || c.id),
      zukanHash: c.zukan_hash || undefined,
      totalStats: total,
    };
  });
}

/**
 * Get search suggestions based on query
 */
export async function getSearchSuggestions(query: string): Promise<string[]> {
  if (!query || query.length < 2) return [];

  const results = await searchGlobal(query);
  const suggestions = new Set<string>();

  for (const result of results) {
    if (result.title) suggestions.add(result.title);
  }

  return Array.from(suggestions).slice(0, 5);
}

// ─── Meta suggestions for search landing page ──────────────────────────────

export interface MetaSuggestion {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string;
  subtitle?: string;
  url: string;
}

export interface MetaSuggestions {
  players: MetaSuggestion[];
  skills: MetaSuggestion[];
  tactics: MetaSuggestion[];
  items: MetaSuggestion[];
  passives: MetaSuggestion[];
}

const SKILL_CATEGORY_FR: Record<string, string> = {
  "1": "Tir",
  "2": "Dribble",
  "3": "Défense",
  "4": "Arrêt",
};

const POSITION_SHORT: Record<string, string> = {
  FW: "ATT",
  MF: "MIL",
  DF: "DEF",
  GK: "GAR",
};

const ELEMENT_SHORT: Record<string, string> = {
  Fire: "Feu",
  Wind: "Vent",
  Forest: "Forêt",
  Mountain: "Montagne",
  Void: "Néant",
};

const ITEM_CATEGORY_FR: Record<string, string> = {
  shoes: "Chaussures",
  misanga: "Misanga",
  accessory: "Accessoire",
  consume: "Consommable",
  special: "Spécial",
  formation: "Formation",
  performance: "Célébration",
  costume: "Costume",
  fashion: "Mode",
  equip: "Équipement",
  special_tactics: "Tactique",
  special_skill: "Passif",
  important: "Important",
};

const PASSIVE_BOOST_FR: Record<string, string> = {
  Tir: "Tir",
  Dribble: "Dribble",
  Attaque: "Attaque",
  Défense: "Défense",
  Arrêt: "Arrêt",
  Récupération: "Récupération",
  Vitesse: "Vitesse",
  Tension: "Tension",
  Brèche: "Brèche",
  Affrontement: "Affrontement",
  Mixte: "Mixte",
  Spécial: "Spécial",
};

/**
 * Get pre-computed meta suggestions for the search landing page.
 * Returns top BASARA players, most powerful skills, enriched tactics,
 * popular items, and key passives.
 */
export async function getMetaSuggestions(): Promise<MetaSuggestions> {
  const supabase = await createClient();

  const [playersRes, skillsRes, tacticsRes, itemsRes, passivesRes] = await Promise.all([
    // Top 10 BASARA by total stats, prefer those with zukan_hash for 3D images
    (supabase as any)
      .from("inagle_characters")
      .select(
        "id, slug, name_fr, name_en, position, element, internal_code, zukan_hash, stat_frappe, stat_controle, stat_technique, stat_pression, stat_physique, stat_agilite, stat_intelligence",
      )
      .eq("rarity_label", "BASARA")
      .not("stat_frappe", "is", null)
      .not("zukan_hash", "is", null)
      .order("stat_frappe", { ascending: false, nullsFirst: false })
      .limit(12),
    // Top 8 skills by power_max with video
    (supabase as any)
      .from("inagle_skills")
      .select("id, name_fr, name_en, category_id, element_id, power_max, video_url, image_url")
      .not("power_max", "is", null)
      .not("video_url", "is", null)
      .order("power_max", { ascending: false, nullsFirst: false })
      .limit(8),
    // 8 enriched tactics (have shop)
    (supabase as any)
      .from("inagle_tactics")
      .select("name, effect1, shop")
      .not("shop", "is", null)
      .order("name")
      .limit(8),
    // Top 8 gameplay items with price (shoes, misanga, accessory, etc.)
    (supabase as any)
      .from("inagle_items")
      .select("id, name_fr, name_en, category, price, image_url")
      .not("price", "is", null)
      .in("category", ["shoes", "misanga", "accessory", "consume", "special", "formation"])
      .not("name_fr", "is", null)
      .order("price", { ascending: false, nullsFirst: false })
      .limit(8),
    // 8 key passives with descriptions (exclude unknown/broken entries)
    (supabase as any)
      .from("inagle_passives")
      .select("id, name_fr, name_en, category, boost_type, description_fr, effect_value")
      .not("name_fr", "is", null)
      .not("description_fr", "is", null)
      .neq("category", "Inconnu")
      .not("description_fr", "ilike", "%[CPASSIVE%")
      .order("effect_value", { ascending: false, nullsFirst: false })
      .limit(8),
  ]);

  // Map BASARA players — use bucket face icons (zukan 3D mirror not available)
  const players: MetaSuggestion[] = (playersRes.data || []).map((c: any) => {
    const total =
      (c.stat_frappe || 0) +
      (c.stat_controle || 0) +
      (c.stat_technique || 0) +
      (c.stat_pression || 0) +
      (c.stat_physique || 0) +
      (c.stat_agilite || 0) +
      (c.stat_intelligence || 0);
    const pos = POSITION_SHORT[c.position] || c.position || "";
    const el = ELEMENT_SHORT[c.element] || c.element || "";
    const parts = [pos, el, total > 0 ? String(total) : ""].filter(Boolean);
    const imageUrl = getCharacterFaceUrl(c.internal_code || c.id);
    return {
      id: c.id,
      slug: c.slug || c.id,
      name: c.name_fr || c.name_en || c.id,
      imageUrl,
      subtitle: parts.join(" · "),
      url: `/chara/${c.slug || c.id}`,
    };
  });

  // Map skills
  const skills: MetaSuggestion[] = (skillsRes.data || []).map((s: any) => {
    const cat = SKILL_CATEGORY_FR[String(s.category_id)] || "";
    const power = s.power_max ? String(s.power_max) : "";
    const parts = [cat, power].filter(Boolean);
    return {
      id: s.id,
      slug: s.id,
      name: s.name_fr || s.name_en || s.id,
      imageUrl: getSkillImageUrl(s.id),
      subtitle: parts.join(" · "),
      url: `/skill/${s.id}`,
    };
  });

  // Map tactics
  const tactics: MetaSuggestion[] = (tacticsRes.data || []).map((t: any) => {
    const nameFr = TACTIC_FR[t.name] || t.name;
    const effect = t.effect1 ? translateEffect(t.effect1) : "";
    return {
      id: t.name,
      slug: t.name
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-+|-+$/g, ""),
      name: nameFr,
      subtitle: effect,
      url: `/tactic/${t.name
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-+|-+$/g, "")}`,
    };
  });

  // Map items — use image_url from DB (correct asset filename)
  const items: MetaSuggestion[] = (itemsRes.data || []).map((i: any) => {
    const catFr = ITEM_CATEGORY_FR[i.category] || i.category || "";
    const price = i.price ? `${i.price} P` : "";
    const parts = [catFr, price].filter(Boolean);
    return {
      id: i.id,
      slug: i.id,
      name: i.name_fr || i.name_en || i.id,
      imageUrl: i.image_url ? resolveAssetUrl(i.image_url) || "" : getItemImageUrl(i.id),
      subtitle: parts.join(" · "),
      url: `/item/${i.id}`,
    };
  });

  // Map passives
  const passives: MetaSuggestion[] = (passivesRes.data || []).map((p: any) => {
    const boostFr = PASSIVE_BOOST_FR[p.boost_type] || p.boost_type || "";
    const catFr =
      p.category === "Joueur" ? "Joueur" : p.category === "Équipe" ? "Équipe" : p.category || "";
    const parts = [catFr, boostFr].filter(Boolean);
    return {
      id: p.id,
      slug: p.id,
      name: p.name_fr || p.name_en || p.id,
      subtitle: parts.join(" · "),
      url: `/passive/${p.id}`,
    };
  });

  return { players, skills, tactics, items, passives };
}
