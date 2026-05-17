export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";

import RgEmote from "@/components/shared/emotes/RgEmote";
import { BreadcrumbSchema } from "@/components/shared/StructuredData";
import { PfpIcon } from "@/components/sidebar/atoms/PfpIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, Palette, Smile, Sparkles, Users } from "@/lib/icons-config";

export const metadata: Metadata = {
  title: "Projets | Rose Griffon",
  description: "Découvrez les outils et initiatives créatives de la communauté Rose Griffon.",
};

export default function ProjetsPage() {
  const projects = [
    {
      title: "Avatar RG",
      description:
        "Créez votre photo de profil aux couleurs de Rose Griffon. Ajoutez le cadre officiel à votre avatar en quelques clics.",
      href: "/projets/outils/pfp",
      icon: PfpIcon,
      emote: "gaelle-fiere" as const,
      color: "text-primary",
      bgColor: "bg-primary/10",
      badge: "Nouveau",
    },
    {
      title: "Nostalgie",
      description:
        "Créez vos propres compositions Inazuma Eleven avec notre outil de collage avancé. Personnalisez, assemblez et partagez vos créations.",
      href: "/projets/nostalgie",
      icon: Palette,
      emote: "gaelle-coeur" as const,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
      badge: "Outil Créatif",
    },
    {
      title: "Muraux Communautaires",
      description:
        "Explorez les galeries collaboratives géantes rassemblant les créations et histoires de la communauté. Un univers étendu par les fans.",
      href: "/projets/muraux",
      icon: Users,
      emote: "rg-funny" as const,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      badge: "Galerie",
    },
    {
      title: "Galerie d'Emotes",
      description:
        "Découvrez la collection complète des emotes officielles Rose Griffon. Gaëlle, Roy et bien plus encore.",
      href: "/projets/emotes",
      icon: Smile,
      emote: "gaelle-surprise" as const,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      badge: "Ressources",
    },
  ];

  return (
    <div className="space-y-12 pb-12">
      <BreadcrumbSchema
        items={[
          { name: "Accueil", item: "/" },
          { name: "Projets", item: "/projets" },
        ]}
      />
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-(--md-sys-color-primary-container) to-(--md-sys-color-surface-variant) p-8 md:p-12 lg:p-16 text-center shadow-sm border border-(--md-sys-color-outline-variant)">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 size-64 rounded-full bg-(--md-sys-color-primary) opacity-10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 size-64 rounded-full bg-(--md-sys-color-tertiary) opacity-10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center rounded-full border border-(--md-sys-color-outline) bg-(--md-sys-color-surface)/50 px-3 py-1 text-sm font-medium text-(--md-sys-color-primary) backdrop-blur-sm">
            <Sparkles className="mr-2 size-4" />
            <span>Espace Créatif</span>
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-(--md-sys-color-on-surface)">
            Nos Projets
          </h1>

          <p className="text-lg md:text-xl text-(--md-sys-color-on-surface-variant) leading-relaxed">
            Découvrez les outils et les espaces collaboratifs développés pour et par la communauté
            Rose Griffon.
          </p>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="grid gap-6 md:grid-cols-2 lg:gap-8">
        {projects.map((project) => (
          <Card
            key={project.title}
            className="group flex flex-col overflow-hidden border-(--md-sys-color-outline-variant) bg-(--md-sys-color-surface) transition-all hover:shadow-md hover:border-(--md-sys-color-primary)/50"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="relative">
                  {/* Icône ou image custom */}
                  {/* Icône */}
                  <div
                    className={`rounded-xl p-3 ${project.bgColor} ${project.color} transition-all group-hover:scale-105`}
                  >
                    <project.icon className="size-8 opacity-30" />
                  </div>
                  {/* Emote Rose Griffon en premier plan */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RgEmote name={project.emote} size={48} animated className="drop-shadow-md" />
                  </div>
                </div>
                <Badge variant="secondary" className="font-medium">
                  {project.badge}
                </Badge>
              </div>
              <CardTitle className="mt-4 text-2xl font-bold text-(--md-sys-color-on-surface) group-hover:text-(--md-sys-color-primary) transition-colors">
                {project.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
              <CardDescription className="text-base text-(--md-sys-color-on-surface-variant)">
                {project.description}
              </CardDescription>
            </CardContent>
            <CardFooter className="pt-4">
              <Button
                asChild
                className="w-full group-hover:translate-x-1 transition-transform"
                variant="default"
              >
                <Link href={project.href}>
                  Accéder au projet
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </section>
    </div>
  );
}
