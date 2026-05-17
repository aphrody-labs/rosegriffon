/**
 * Configuration des emotes Rose Griffon
 * Emotes disponibles pour utilisation sur le site
 */

export interface Emote {
  name: string;
  path: string;
  character: "gaelle" | "roy" | "rg" | "other";
  category: "reaction" | "greeting" | "emotion";
  alt: string;
  author?: string;
  authorUrl?: string;
}

export const EMOTES: Record<string, Emote> = {
  // Gaëlle
  "gaelle-coeur": {
    name: "gaelle-coeur",
    path: "/emote/RG_Gaelle_coeur1.webp",
    character: "gaelle",
    category: "emotion",
    alt: "Gaëlle avec un cœur",
    author: "Dleez",
  },
  "gaelle-fiere": {
    name: "gaelle-fiere",
    path: "/emote/RG_Gaelle_fiere.webp",
    character: "gaelle",
    category: "reaction",
    alt: "Gaëlle fière",
    author: "Yafl1n",
    authorUrl: "https://x.com/Yaaflin",
  },
  "gaelle-perplexe": {
    name: "gaelle-perplexe",
    path: "/emote/RG_Gaelle_perplexe.webp",
    character: "gaelle",
    category: "reaction",
    alt: "Gaëlle perplexe",
    author: "Dleez",
  },
  "gaelle-salut": {
    name: "gaelle-salut",
    path: "/emote/RG_Gaelle_salut.webp",
    character: "gaelle",
    category: "greeting",
    alt: "Gaëlle fait un salut",
    author: "Dleez",
  },
  "gaelle-surprise": {
    name: "gaelle-surprise",
    path: "/emote/RG_Gaelle_surprise.webp",
    character: "gaelle",
    category: "reaction",
    alt: "Gaëlle surprise",
    author: "Yafl1n",
    authorUrl: "https://x.com/Yaaflin",
  },
  "gaelle-sweat": {
    name: "gaelle-sweat",
    path: "/emote/RG_gaelle_sweat.webp",
    character: "gaelle",
    category: "reaction",
    alt: "Gaëlle gênée",
    author: "Dleez",
  },
  "gaelle-yeux": {
    name: "gaelle-yeux",
    path: "/emote/RG_gaelle_yeux3.webp",
    character: "gaelle",
    category: "reaction",
    alt: "Gaëlle avec des yeux",
  },

  // Roy
  "roy-coeur": {
    name: "roy-coeur",
    path: "/emote/RG_Roy_coeur1.webp",
    character: "roy",
    category: "emotion",
    alt: "Roy avec un cœur",
    author: "Dleez",
  },
  "roy-degout": {
    name: "roy-degout",
    path: "/emote/RG_Roy_degout.webp",
    character: "roy",
    category: "reaction",
    alt: "Roy dégoûté",
    author: "Yafl1n",
    authorUrl: "https://x.com/Yaaflin",
  },
  "roy-evil": {
    name: "roy-evil",
    path: "/emote/RG_Roy_evil.webp",
    character: "roy",
    category: "reaction",
    alt: "Roy maléfique",
    author: "Yafl1n",
    authorUrl: "https://x.com/Yaaflin",
  },
  "roy-pensif": {
    name: "roy-pensif",
    path: "/emote/RG_Roy_pensif.webp",
    character: "roy",
    category: "reaction",
    alt: "Roy pensif",
    author: "Dleez",
  },
  "roy-salut": {
    name: "roy-salut",
    path: "/emote/RG_Roy_salut.webp",
    character: "roy",
    category: "greeting",
    alt: "Roy fait un salut",
    author: "Dleez",
  },
  "roy-sweat": {
    name: "roy-sweat",
    path: "/emote/RG_roy_sweat.webp",
    character: "roy",
    category: "reaction",
    alt: "Roy gêné",
    author: "Dleez",
  },
  "roy-yeux": {
    name: "roy-yeux",
    path: "/emote/RG_roy_yeux.webp",
    character: "roy",
    category: "reaction",
    alt: "Roy avec des yeux",
  },
  "roy-fine": {
    name: "roy-fine",
    path: "/emote/RG_roy_fine.webp",
    character: "roy",
    category: "emotion",
    alt: "Roy content",
    author: "Dleez",
  },

  // Rose Griffon
  "rg-funny": {
    name: "rg-funny",
    path: "/emote/RG_funny.webp",
    character: "rg",
    category: "reaction",
    alt: "Rose Griffon drôle",
    author: "Dleez",
  },
};

/**
 * Obtenir une emote par son nom
 */
export function getEmote(name: string): Emote | undefined {
  return EMOTES[name];
}

/**
 * Obtenir toutes les emotes d'un personnage
 */
export function getEmotesByCharacter(character: "gaelle" | "roy" | "rg"): Emote[] {
  return Object.values(EMOTES).filter((emote) => emote.character === character);
}

/**
 * Obtenir toutes les emotes d'une catégorie
 */
export function getEmotesByCategory(category: "reaction" | "greeting" | "emotion"): Emote[] {
  return Object.values(EMOTES).filter((emote) => emote.category === category);
}

/**
 * Obtenir une emote aléatoire
 */
export function getRandomEmote(): Emote {
  const emotes = Object.values(EMOTES);
  return emotes[Math.floor(Math.random() * emotes.length)]!;
}

/**
 * Obtenir une emote aléatoire d'un personnage
 */
export function getRandomEmoteByCharacter(character: "gaelle" | "roy" | "rg"): Emote {
  const emotes = getEmotesByCharacter(character);
  return emotes[Math.floor(Math.random() * emotes.length)]!;
}
