/**
 * Configuration des réseaux sociaux
 * Avec meilleurs libellés et support dark mode
 * Séparé de sidebar-config.ts pour éviter les dépendances circulaires ou le chargement inutile de composants
 */
export const socialConfig = [
  {
    ariaLabel: "Suivre Rose Griffon sur Twitter (X)",
    color: "hover:bg-black dark:hover:bg-gray-800",
    iconColor: "#000000",
    name: "Twitter",
    shortName: "X",
    url: "https://x.com/rose_griffon",
  },
  {
    ariaLabel: "Rejoindre le serveur Discord Rose Griffon",
    badge: "Rejoignez-nous!",
    color: "hover:bg-[#5865F2] dark:hover:bg-[#4752C4]",
    iconColor: "#5865F2",
    name: "Discord",
    shortName: "DC",
    url: "https://discord.gg/TYzQvbByv4",
  },
  {
    ariaLabel: "Suivre Rose Griffon TV sur Twitch",
    color: "hover:bg-[#9146FF] dark:hover:bg-[#772CE8]",
    iconColor: "#9146FF",
    name: "Twitch",
    shortName: "TW",
    url: "https://twitch.tv/rose_griffontv",
  },
  {
    ariaLabel: "S'abonner à la chaîne YouTube Rose Griffon",
    color: "hover:bg-[#FF0000] dark:hover:bg-[#CC0000]",
    iconColor: "#FF0000",
    name: "YouTube",
    shortName: "YT",
    url: "https://www.youtube.com/@RoseGriffon",
  },
  {
    ariaLabel: "Suivre Rose Griffon sur Instagram",
    color: "hover:bg-linear-to-tr hover:from-[#FD5949] hover:via-[#D6249F] hover:to-[#285AEB]",
    iconColor: "#E4405F",
    name: "Instagram",
    shortName: "IG",
    url: "https://www.instagram.com/rose_griffonfr",
  },
];
