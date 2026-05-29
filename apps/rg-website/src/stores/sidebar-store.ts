"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface SidebarStore {
	isOpen: boolean;
	openSections: string[];
	isHydrated: boolean;
	error: string | null;
	toggleSidebar: () => void;
	toggleSection: (section: string) => void;
	setSidebarOpen: (open: boolean) => void;
	setHydrated: (hydrated: boolean) => void;
}

// Debounce utility
const debounce = <T extends (...args: any[]) => void>(fn: T, ms: number) => {
	let timeoutId: NodeJS.Timeout;
	return function debounce(this: unknown, ...args: Parameters<T>) {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn.apply(this, args), ms);
	};
};

const debouncedSetItem = debounce((name: string, value: string) => {
	try {
		if (typeof window === "undefined") {
			return;
		}
		localStorage.setItem(name, value);
	} catch (error) {
		if (process.env.NODE_ENV === "development") {
			console.error("Erreur lors de l'écriture dans le localStorage (sidebar):", error);
		}
	}
}, 500);

/**
 * Storage sécurisé avec gestion d'erreurs et debounce
 */
const safeStorage = {
	getItem: (name: string): string | null => {
		try {
			if (typeof window === "undefined") return null;
			return localStorage.getItem(name);
		} catch (error) {
			if (process.env.NODE_ENV === "development") {
				console.error("Erreur lors de la lecture du localStorage (sidebar):", error);
			}
			return null;
		}
	},
	removeItem: (name: string): void => {
		try {
			if (typeof window === "undefined") return;
			localStorage.removeItem(name);
		} catch (error) {
			if (process.env.NODE_ENV === "development") {
				console.error("Erreur lors de la suppression du localStorage (sidebar):", error);
			}
		}
	},
	setItem: debouncedSetItem,
};

export const useSidebarStore = create<SidebarStore>()(
	persist(
		(set, get) => ({
			error: null,
			isHydrated: false,
			isOpen: true,
			openSections: [],
			setHydrated: (hydrated) => set({ isHydrated: hydrated }),
			setSidebarOpen: (open) => {
				try {
					if (typeof open !== "boolean") {
						if (process.env.NODE_ENV === "development") {
							console.error("setSidebarOpen attend un booléen");
						}
						return;
					}
					set({ isOpen: open, error: null });
				} catch (error) {
					if (process.env.NODE_ENV === "development") {
						console.error("Erreur lors du changement d'état de la sidebar:", error);
					}
					set({
						error: error instanceof Error ? error.message : "Erreur inconnue",
					});
				}
			},
			toggleSection: (section) => {
				try {
					if (!section || typeof section !== "string") {
						if (process.env.NODE_ENV === "development") {
							console.error("toggleSection attend une chaîne non vide");
						}
						return;
					}

					const openSections = get().openSections;
					if (openSections.includes(section)) {
						set({
							openSections: openSections.filter((s) => s !== section),
							error: null,
						});
					} else {
						set({ openSections: [...openSections, section], error: null });
					}
				} catch (error) {
					if (process.env.NODE_ENV === "development") {
						console.error("Erreur lors du toggle section:", error);
					}
					set({
						error: error instanceof Error ? error.message : "Erreur inconnue",
					});
				}
			},
			toggleSidebar: () => {
				try {
					set({ isOpen: !get().isOpen, error: null });
				} catch (error) {
					if (process.env.NODE_ENV === "development") {
						console.error("Erreur lors du toggle sidebar:", error);
					}
					set({
						error: error instanceof Error ? error.message : "Erreur inconnue",
					});
				}
			},
		}),
		{
			name: "sidebar-storage",
			storage: createJSONStorage(() => safeStorage),
			// Persister à la fois isOpen et openSections maintenant
			partialize: (state) => ({
				isOpen: state.isOpen,
				openSections: state.openSections,
			}),
			onRehydrateStorage: () => (state) => {
				if (state) {
					state.setHydrated(true);

					// Valider openSections après réhydratation
					if (Array.isArray(state.openSections)) {
						const validSections = state.openSections.filter(
							(section) => typeof section === "string" && section.length > 0
						);

						if (validSections.length !== state.openSections.length) {
							if (process.env.NODE_ENV === "development") {
								console.warn("Certaines sections invalides ont été retirées");
							}
							state.openSections = validSections;
						}
					} else {
						if (process.env.NODE_ENV === "development") {
							console.warn("openSections n'est pas un tableau, réinitialisation");
						}
						state.openSections = [];
					}
				}
			},
		}
	)
);
