// Polices auto-hébergées (sous-ensemble latin, licence OFL) : `next/font/google`
// téléchargeait les CSS de Google à chaque build, et un format de réponse
// inattendu faisait échouer le build de prod (2026-11-05). Fichiers dans src/fonts.
import localFont from "next/font/local";

// Body principal — preload activé.
export const roboto = localFont({
  display: "swap",
  src: [
    { path: "../fonts/roboto-400.woff2", style: "normal", weight: "400" },
    { path: "../fonts/roboto-500.woff2", style: "normal", weight: "500" },
    { path: "../fonts/roboto-700.woff2", style: "normal", weight: "700" },
  ],
  variable: "--font-roboto",
});

// Titres marketing — preload activé.
export const poppins = localFont({
  display: "swap",
  src: [
    { path: "../fonts/poppins-600.woff2", style: "normal", weight: "600" },
    { path: "../fonts/poppins-700.woff2", style: "normal", weight: "700" },
  ],
  variable: "--font-poppins",
});

// ============================================
// POLICES POUR LE THÈME AZALÉE
// ============================================
// Preload=false : n'apparaissent que sur pages secondaires —
// Ne pas pénaliser la home en preloadant inutilement.

export const notoSans = localFont({
  display: "swap",
  preload: false,
  src: [
    { path: "../fonts/noto-sans-400.woff2", style: "normal", weight: "400" },
    { path: "../fonts/noto-sans-700.woff2", style: "normal", weight: "700" },
  ],
  variable: "--font-noto-sans",
});

export const lato = localFont({
  display: "swap",
  preload: false,
  src: [
    { path: "../fonts/lato-400.woff2", style: "normal", weight: "400" },
    { path: "../fonts/lato-700.woff2", style: "normal", weight: "700" },
  ],
  variable: "--font-lato",
});
