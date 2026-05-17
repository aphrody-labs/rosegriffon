"use client";

import { useCallback, useMemo, useState } from "react";

import {
  EMOTES,
  type Emote,
  getEmotesByCategory,
  getEmotesByCharacter,
  getRandomEmote,
  getRandomEmoteByCharacter,
} from "@/lib/emotes";

/**
 * Hook pour utiliser les emotes Rose Griffon
 * Fournit des utilitaires pour manipuler et afficher les emotes
 */
export function useEmotes() {
  const [selectedEmote, setSelectedEmote] = useState<Emote | null>(null);

  const allEmotes = useMemo(() => Object.values(EMOTES), []);

  const selectEmote = useCallback((emoteName: keyof typeof EMOTES) => {
    const emote = EMOTES[emoteName];
    if (emote) {
      setSelectedEmote(emote);
    }
  }, []);

  const selectRandomEmote = useCallback(() => {
    const emote = getRandomEmote();
    setSelectedEmote(emote);
    return emote;
  }, []);

  const selectRandomByCharacter = useCallback((character: "gaelle" | "roy" | "rg") => {
    const emote = getRandomEmoteByCharacter(character);
    setSelectedEmote(emote);
    return emote;
  }, []);

  const getByCharacter = useCallback((character: "gaelle" | "roy" | "rg") => {
    return getEmotesByCharacter(character);
  }, []);

  const getByCategory = useCallback((category: "reaction" | "greeting" | "emotion") => {
    return getEmotesByCategory(category);
  }, []);

  return {
    /** Toutes les emotes disponibles */
    allEmotes,
    /** Emote actuellement sélectionnée */
    selectedEmote,
    /** Sélectionner une emote par son nom */
    selectEmote,
    /** Sélectionner une emote aléatoire */
    selectRandomEmote,
    /** Sélectionner une emote aléatoire d'un personnage */
    selectRandomByCharacter,
    /** Obtenir les emotes d'un personnage */
    getByCharacter,
    /** Obtenir les emotes d'une catégorie */
    getByCategory,
    /** Réinitialiser la sélection */
    clearSelection: () => setSelectedEmote(null),
  };
}

/**
 * Hook pour gérer l'historique de sélection d'emotes
 */
export function useEmoteHistory(maxHistory: number = 10) {
  const [history, setHistory] = useState<Emote[]>([]);

  const addToHistory = useCallback(
    (emote: Emote) => {
      setHistory((prev) => {
        // Supprimer les doublons et ajouter en tête
        const filtered = prev.filter((e) => e.name !== emote.name);
        const newHistory = [emote, ...filtered];
        // Limiter l'historique
        return newHistory.slice(0, maxHistory);
      });
    },
    [maxHistory]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return {
    /** Historique des emotes utilisées (les plus récentes en premier) */
    history,
    /** Ajouter une emote à l'historique */
    addToHistory,
    /** Effacer l'historique */
    clearHistory,
  };
}

/**
 * Hook pour les animations aléatoires d'emotes
 * Utile pour afficher des emotes qui changent périodiquement
 */
export function useEmoteRotation(interval: number = 3000, character?: "gaelle" | "roy" | "rg") {
  const [currentEmote, setCurrentEmote] = useState<Emote>(
    character ? getRandomEmoteByCharacter(character) : getRandomEmote()
  );

  const rotate = useCallback(() => {
    const newEmote = character ? getRandomEmoteByCharacter(character) : getRandomEmote();
    setCurrentEmote(newEmote);
  }, [character]);

  // Auto-rotation
  useMemo(() => {
    if (interval > 0) {
      const timer = setInterval(rotate, interval);
      return () => clearInterval(timer);
    }
  }, [interval, rotate]);

  return {
    /** Emote actuellement affichée */
    currentEmote,
    /** Changer manuellement d'emote */
    rotate,
  };
}

/**
 * Hook pour valider si un texte contient des emotes valides
 */
export function useEmoteValidation(text: string) {
  const validation = useMemo(() => {
    const emotePattern = /:([a-z]+-?[a-z]+):/g;
    const matches = [...text.matchAll(emotePattern)];

    const valid: string[] = [];
    const invalid: string[] = [];

    matches.forEach((match) => {
      const emoteName = match[1];
      if (emoteName && Object.hasOwn(EMOTES, emoteName)) {
        valid.push(emoteName);
      } else if (emoteName) {
        invalid.push(emoteName);
      }
    });

    return {
      /** Emotes valides trouvées */
      valid,
      /** Emotes invalides (non trouvées dans EMOTES) */
      invalid,
      /** Le texte contient-il des emotes valides ? */
      hasValidEmotes: valid.length > 0,
      /** Le texte contient-il des emotes invalides ? */
      hasInvalidEmotes: invalid.length > 0,
      /** Toutes les emotes sont-elles valides ? */
      isFullyValid: invalid.length === 0 && valid.length > 0,
    };
  }, [text]);

  return validation;
}
