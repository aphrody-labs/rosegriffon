import { Instagram, Twitter } from "@/lib/brand-icons";
import { MARQUES } from "@/lib/feed/comptes";
import type { Reseau } from "@/lib/feed/types";

function IconeTiktok({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
    </svg>
  );
}

const ICONES = { x: Twitter, instagram: Instagram, tiktok: IconeTiktok } as const;

/** Pastille du réseau : la couleur de marque est la seule couleur brute de la page. */
export function BadgeReseau({ reseau, taille = 20 }: { reseau: Reseau; taille?: number }) {
  const Icone = ICONES[reseau];
  const marque = MARQUES[reseau];
  return (
    <span
      title={marque.nom}
      className="inline-flex shrink-0 items-center justify-center rounded-full text-white ring-1 ring-outline-variant"
      style={{ backgroundColor: marque.couleur, width: taille, height: taille }}
    >
      <Icone className="size-[60%]" aria-hidden />
      <span className="sr-only">{marque.nom}</span>
    </span>
  );
}
