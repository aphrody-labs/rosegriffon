"use client";

import { AnimatePresence, motion } from "motion/react";
import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@rose-griffon/ui";

// Mapping des routes pour un affichage plus convivial
const routeMapping: Record<string, string> = {
  "a-propos": "À Propos",
  account: "Mon Compte",
  admin: "Administration",
  association: "L'Association",
  "cellule-de-mediation": "Médiation",
  "charte-engagements": "Charte et Engagements",
  chroniques: "Chroniques",
  contact: "Contact",
  dashboard: "Tableau de bord",
  emotes: "Galerie d'Émotes",
  evenements: "Événements",
  muraux: "Muraux",
  nostalgie: "Nostalgie VR",
  "notre-equipe": "Notre Équipe",
  outils: "Outils",
  partenaires: "Partenaires",
  pfp: "Avatar RG",
  projets: "Projets",
  "rejoindre-rg": "Nous Rejoindre",
  "rose-griffon-tv": "Rose Griffon TV",
  settings: "Paramètres",
  soutenir: "Nous Soutenir",
  staff: "Équipe",
};

interface GlobalBreadcrumbProps {
  mobileMode?: boolean;
}

export default function GlobalBreadcrumb({ mobileMode = false }: GlobalBreadcrumbProps) {
  const pathname = usePathname();

  // Si nous sommes sur la page d'accueil ou si le pathname est null, ne pas afficher le fil d'Ariane
  if (!pathname || pathname === "/") {
    return null;
  }

  // Diviser le chemin en segments
  const segments = pathname.split("/").filter(Boolean);

  // Fonction pour obtenir le nom d'affichage
  const getDisplayName = (segment: string) => {
    if (routeMapping[segment]) {
      return routeMapping[segment];
    }
    // Fallback: première lettre en majuscule, remplacer les tirets par des espaces
    return segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Mode mobile : afficher uniquement le nom de la page courante
  if (mobileMode) {
    const lastSegment = segments.at(-1);
    if (!lastSegment) {return null;}
    const displayName = getDisplayName(lastSegment);
    return (
      <span className="font-semibold text-sm text-foreground truncate block">{displayName}</span>
    );
  }

  // Créer les liens pour chaque segment
  const breadcrumbItems = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isLast = index === segments.length - 1;
    const displayName = getDisplayName(segment);

    return (
      <BreadcrumbItem key={href}>
        {isLast ? (
          <BreadcrumbPage className="font-bold text-primary flex items-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={displayName}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
              >
                {displayName}
              </motion.span>
            </AnimatePresence>
          </BreadcrumbPage>
        ) : (
          <BreadcrumbLink href={href} className="hover:text-primary transition-colors">
            {displayName}
          </BreadcrumbLink>
        )}
        {!isLast && <BreadcrumbSeparator />}
      </BreadcrumbItem>
    );
  });

  // Ajouter le lien vers la page d'accueil
  const homeItem = (
    <BreadcrumbItem key="/">
      <BreadcrumbLink href="/" className="hover:text-primary transition-colors">
        Accueil
      </BreadcrumbLink>
      <BreadcrumbSeparator />
    </BreadcrumbItem>
  );

  // Gérer l'affichage avec ellipsis si nécessaire
  let displayItems = [homeItem, ...breadcrumbItems];

  // Si nous avons plus de 3 segments (accueil + 2 ou plus), ajouter des ellipsis
  if (segments.length > 3) {
    displayItems = [
      homeItem,
      <BreadcrumbItem key="ellipsis">
        <BreadcrumbEllipsis />
        <BreadcrumbSeparator />
      </BreadcrumbItem>,
      ...breadcrumbItems.slice(-2), // Afficher les 2 derniers segments
    ];
  }

  return (
    <Breadcrumb className="h-7 flex items-center">
      <BreadcrumbList>{displayItems}</BreadcrumbList>
    </Breadcrumb>
  );
}
