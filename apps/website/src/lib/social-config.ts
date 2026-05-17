/**
 * Configuration des réseaux sociaux
 * Avec meilleurs libellés et support dark mode
 * Séparé de sidebar-config.ts pour éviter les dépendances circulaires ou le chargement inutile de composants
 */
export const socialConfig = [
  {
    name: "Twitter",
    url: "https://x.com/rose_griffon",
    color: "hover:bg-black dark:hover:bg-gray-800",
    ariaLabel: "Suivre Rose Griffon sur Twitter (X)",
    iconColor: "#000000",
    shortName: "X",
  },
  {
    name: "Discord",
    url: "https://discord.gg/TYzQvbByv4",
    color: "hover:bg-[#5865F2] dark:hover:bg-[#4752C4]",
    ariaLabel: "Rejoindre le serveur Discord Rose Griffon",
    iconColor: "#5865F2",
    shortName: "DC",
    badge: "Rejoignez-nous!",
  },
  {
    name: "Twitch",
    url: "https://twitch.tv/rose_griffontv",
    color: "hover:bg-[#9146FF] dark:hover:bg-[#772CE8]",
    ariaLabel: "Suivre Rose Griffon TV sur Twitch",
    iconColor: "#9146FF",
    shortName: "TW",
  },
  {
    name: "YouTube",
    url: "https://www.youtube.com/@RoseGriffon",
    color: "hover:bg-[#FF0000] dark:hover:bg-[#CC0000]",
    ariaLabel: "S'abonner à la chaîne YouTube Rose Griffon",
    iconColor: "#FF0000",
    shortName: "YT",
  },
  {
    name: "Instagram",
    url: "https://www.instagram.com/rose_griffonfr",
    color: "hover:bg-linear-to-tr hover:from-[#FD5949] hover:via-[#D6249F] hover:to-[#285AEB]",
    ariaLabel: "Suivre Rose Griffon sur Instagram",
    iconColor: "#E4405F",
    shortName: "IG",
  },
];
