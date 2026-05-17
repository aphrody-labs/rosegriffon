"use client";

import Image from "next/image";
import Link from "next/link";

import { PfpIcon } from "@/components/sidebar/atoms/PfpIcon";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Instagram,
  Twitter,
  Users,
} from "@/lib/icons-config";
import DiscordIcon from "@/shared/icons/discord";

type SocialLink = {
  url: string;
  label: string;
  icon: "twitter" | "instagram" | "discord" | "site";
};

type Project = {
  title: string;
  description: string;
  icon: any; // Using any for simplicity as it's a component
  href: string;
  image: string;
  color: string;
  stats: string;
  external?: boolean;
  socials?: SocialLink[];
};

const projects: Project[] = [
  {
    title: "Nostalgie",
    description: "Créez vos montages comparatifs 2011 vs Victory Road",
    icon: ImageIcon,
    href: "/projets/nostalgie",
    image: "/roygaelle.webp",
    color: "from-blue-500 to-purple-600",
    stats: "🎨 Outil ",
  },
  {
    title: "Avatar RG",
    description: "Créez votre photo de profil aux couleurs de Rose Griffon",
    icon: PfpIcon,
    href: "/projets/outils/pfp",
    image: "/avatarRG/avatarRG.webp",
    color: "from-pink-500 to-rose-500",
    stats: "✨ Nouveau",
  },
  {
    title: "Communauté",
    description: "Galerie des créations de la communauté",
    icon: Users,
    href: "/projets/muraux",
    image: "/frsque.webp",
    color: "from-purple-500 to-pink-600",
    stats: "👥 Galerie",
  },
];

const getSocialIcon = (iconType: "twitter" | "instagram" | "discord" | "site") => {
  switch (iconType) {
    case "twitter":
      return Twitter;
    case "instagram":
      return Instagram;
    case "discord":
      return DiscordIcon;
    case "site":
      return Globe;
    default:
      return ExternalLink;
  }
};

export default function ProjectsSection() {
  return (
    <div className="space-y-8 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center space-y-3 mb-12">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white tracking-tight">
          Nos Projets
        </h2>
        <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto leading-relaxed font-medium">
          Découvrez l'écosystème Rose Griffon : médias, outils et contenus communautaires
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
        {projects.map((project) => {
          const IconComponent = project.icon;
          return (
            <Link
              href={project.href}
              target={project.external ? "_blank" : undefined}
              key={project.title}
              className="block h-full group outline-none"
            >
              <Card
                className={`h-full overflow-hidden border-0 bg-white dark:bg-zinc-900/50 shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 rounded-3xl relative isolate ring-1 ring-zinc-200 dark:ring-zinc-800 hover:ring-[#a14b3f]/50 dark:hover:ring-[#a14b3f]/50 p-0 ${project.title === "Azalée" ? "azalee" : ""}`}
              >
                {/* Background Gradient Blob */}
                <div
                  className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 bg-gradient-to-br ${project.color}`}
                />

                <CardContent className="p-0 flex flex-col h-full">
                  {/* Image Container */}
                  <div className="relative h-56 sm:h-64 overflow-hidden">
                    {project.image ? (
                      <Image
                        src={project.image}
                        alt={project.title}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={`w-full h-full bg-gradient-to-br ${project.color} flex items-center justify-center`}
                      >
                        <IconComponent className="w-24 h-24 text-muted-foreground/30 group-hover:scale-110 transition-transform duration-500" />
                      </div>
                    )}

                    {/* Overlay Gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />

                    {/* Top Badge */}
                    <div className="absolute top-4 right-4">
                      <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-border shadow-lg">
                        <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse`} />
                          {project.stats.split(" ").slice(1).join(" ") || project.stats}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Content Container */}
                  <div className="p-6 sm:p-8 flex flex-col grow space-y-4 relative bg-white dark:bg-zinc-900">
                    {/* Decorative line */}
                    <div
                      className={`absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r ${project.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                    />

                    <div className="space-y-3 grow">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-xl bg-gray-100 dark:bg-zinc-800 text-gray-900 dark:text-white group-hover:bg-[#a14b3f] group-hover:text-white transition-colors duration-300 shadow-sm`}
                        >
                          <IconComponent className="w-5 h-5" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                          {project.title}
                        </h3>
                      </div>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 font-medium">
                        {project.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-zinc-800 mt-auto">
                      {/* Social Links */}
                      <div className="flex items-center gap-1">
                        {project.socials?.map((social: SocialLink) => {
                          const SocialIcon = getSocialIcon(social.icon);
                          return (
                            <a
                              key={social.url}
                              href={social.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-2 rounded-lg text-gray-400 hover:text-[#a14b3f] hover:bg-[#a14b3f]/10 transition-all duration-300 relative z-10 hover:scale-110"
                              title={social.label}
                              aria-label={social.label}
                            >
                              <SocialIcon className="w-4 h-4" />
                            </a>
                          );
                        })}
                      </div>

                      {/* CTA Button */}
                      <div className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white group-hover:text-[#a14b3f] dark:group-hover:text-[#ff6b6b] transition-colors duration-300 group/btn">
                        <span>Explorer</span>
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-zinc-800 group-hover/btn:bg-[#a14b3f]/10 flex items-center justify-center transition-all duration-300 group-hover/btn:scale-110">
                          <ArrowRight className="w-4 h-4 group-hover/btn:-rotate-45 transition-transform duration-300" />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
