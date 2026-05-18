import { Lato, Noto_Sans, Poppins, Roboto } from "next/font/google";

// Body principal — preload activé.
export const roboto = Roboto({
	weight: ["400", "500", "700"],
	subsets: ["latin"],
	display: "swap",
	variable: "--font-roboto",
});

// Titres marketing — preload activé.
export const poppins = Poppins({
	weight: ["600", "700"],
	subsets: ["latin"],
	display: "swap",
	variable: "--font-poppins",
});

// ============================================
// POLICES POUR LE THÈME AZALÉE
// ============================================
// preload=false : n'apparaissent que sur pages secondaires —
// ne pas pénaliser la home en preloadant inutilement.

export const notoSans = Noto_Sans({
	weight: ["400", "700"],
	subsets: ["latin"],
	display: "swap",
	variable: "--font-noto-sans",
	preload: false,
});

export const lato = Lato({
	weight: ["400", "700"],
	subsets: ["latin"],
	display: "swap",
	variable: "--font-lato",
	preload: false,
});
