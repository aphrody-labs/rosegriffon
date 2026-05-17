"use client";

import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

// Palette Rose Griffon - Référence officielle
export const THEMES = {
	roy: {
		name: "Roy",
		icon: "/emote/RG_Roy_salut.webp",
		colors: {
			primary: "#344E8C", // Bleu Roy (cheveux Roy / yeux Gaëlle)
			secondary: "#243D5B", // Bleu foncé
			accent: "#FFC46E", // Doré
			background: "#F2F6F7", // Blanc
			text: "#373434", // Noir
		},
	},
	gaelle: {
		name: "Gaëlle",
		icon: "/emote/RG_Gaelle_salut.webp",
		colors: {
			primary: "#B03519", // Vermillon (cheveux Gaëlle)
			secondary: "#770007", // Rouge (yeux Roy)
			accent: "#FFC46E", // Doré
			background: "#F2F6F7", // Blanc
			text: "#373434", // Noir
		},
	},
} as const;

export type ThemeType = keyof typeof THEMES;

interface ThemeContextType {
	theme: ThemeType;
	setTheme: (theme: ThemeType) => void;
	toggleTheme: () => void;
	colors: (typeof THEMES)[ThemeType]["colors"];
	isRoy: boolean;
	isGaelle: boolean;
	mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setThemeState] = useState<ThemeType>("roy");
	const [mounted, setMounted] = useState(false);

	// Initialisation du thème depuis le localStorage
	useEffect(() => {
		// Avoid synchronous state update warning
		const timer = setTimeout(() => {
			setMounted(true);
			try {
				const saved = localStorage.getItem("rg-theme") as ThemeType;
				if (saved && Object.keys(THEMES).includes(saved)) {
					setThemeState(saved);
				}
			} catch (e) {
				console.warn("Failed to read theme from localStorage", e);
			}
		}, 0);
		return () => clearTimeout(timer);
	}, []);

	// Application des variables CSS et sauvegarde
	useEffect(() => {
		if (!mounted) return;

		const root = document.documentElement;
		const colors = THEMES[theme].colors;

		// Appliquer la classe du thème sur l'élément racine
		Object.keys(THEMES).forEach((t) => root.classList.remove(t));
		root.classList.add(theme);

		root.style.setProperty("--theme-primary", colors.primary);
		root.style.setProperty("--theme-secondary", colors.secondary);
		root.style.setProperty("--theme-accent", colors.accent);
		root.style.setProperty("--theme-background", colors.background);
		root.style.setProperty("--theme-text", colors.text);

		try {
			localStorage.setItem("rg-theme", theme);
		} catch (e) {
			console.warn("Failed to save theme to localStorage", e);
		}
	}, [theme, mounted]);

	const setTheme = useCallback((newTheme: ThemeType) => {
		setThemeState(newTheme);
	}, []);

	const toggleTheme = useCallback(() => {
		setThemeState((prev) => (prev === "roy" ? "gaelle" : "roy"));
	}, []);

	const value = useMemo(
		() => ({
			theme,
			setTheme,
			toggleTheme,
			colors: THEMES[theme].colors,
			isRoy: theme === "roy",
			isGaelle: theme === "gaelle",
			mounted,
		}),
		[theme, mounted, toggleTheme, setTheme],
	);

	return (
		<ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
	);
}

export function useTheme() {
	const context = useContext(ThemeContext);
	if (context === undefined) {
		throw new Error("useTheme must be used within a ThemeProvider");
	}
	return context;
}
