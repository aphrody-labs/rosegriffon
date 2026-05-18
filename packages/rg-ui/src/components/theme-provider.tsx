"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, type ThemeProviderProps } from "next-themes";
import { THEMES, type ThemeType } from "../lib/themes";

export interface RGThemeProviderProps extends ThemeProviderProps {
	children: React.ReactNode;
}

/**
 * Unified Theme Provider for Rose Griffon.
 * Handles both the next-themes logic and the custom CSS variables for M3/Legacy themes.
 */
export function ThemeProvider({
	children,
	attribute = "class",
	defaultTheme = "roy",
	storageKey = "rg-theme",
	...props
}: RGThemeProviderProps) {
	return (
		<NextThemesProvider
			attribute={attribute}
			defaultTheme={defaultTheme}
			storageKey={storageKey}
			{...props}
		>
			<ThemeSync>{children}</ThemeSync>
		</NextThemesProvider>
	);
}

/**
 * Helper component to sync the active theme's colors to CSS variables
 * if the app still relies on them (legacy compat).
 */
function ThemeSync({ children }: { children: React.ReactNode }) {
	const { theme } = useTheme();

	React.useEffect(() => {
		const root = document.documentElement;
		const activeTheme = theme as ThemeType;

		if (THEMES[activeTheme]) {
			const colors = THEMES[activeTheme].colors;
			root.style.setProperty("--theme-primary", colors.primary);
			root.style.setProperty("--theme-secondary", colors.secondary);
			root.style.setProperty("--theme-accent", colors.accent);
			root.style.setProperty("--theme-background", colors.background);
			root.style.setProperty("--theme-text", colors.text);
		}
	}, [theme]);

	return <>{children}</>;
}

// Re-export useTheme from next-themes for convenience, or custom if needed
import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
	const context = useNextTheme();
	const [mounted, setMounted] = React.useState(false);

	React.useEffect(() => {
		setMounted(true);
	}, []);

	const toggleTheme = React.useCallback(() => {
		const next = context.theme === "roy" ? "gaelle" : "roy";
		context.setTheme(next);
	}, [context]);

	return {
		...context,
		mounted,
		toggleTheme,
		isRoy: context.theme === "roy",
		isGaelle: context.theme === "gaelle",
		isAzalee: context.theme?.startsWith("azalee"),
		colors: THEMES[context.theme as ThemeType]?.colors,
	};
}
