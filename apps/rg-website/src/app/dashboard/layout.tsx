import type { Metadata } from "next";
import type { ReactNode } from "react";

// Tableau de bord des rédacteurs : page privée, derrière une session. Rien à indexer, et son
// rendu anonyme (redirection vers /login) ne doit pas entrer dans l'index
// sous le titre par défaut du site. Vit ici et non dans la page, qui peut
// être un composant client.
export const metadata: Metadata = {
  robots: { follow: false, index: false },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
