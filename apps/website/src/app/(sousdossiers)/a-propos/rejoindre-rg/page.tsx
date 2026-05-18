import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@rosegriffon/ui";
import {
  ArrowRight,
  Award,
  Briefcase,
  CheckCircle,
  Heart,
  Mail,
  MapPin,
  MessageCircle,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";

import { getAllTeamMembers } from "@/app/admin/staff/actions";

export const dynamic = "force-dynamic";

export default async function RejoindreRGPage() {
  const { data: members } = await getAllTeamMembers();
  // `getAllTeamMembers` retourne aussi les inactifs (côté admin), on ne compte que les actifs.
  const activeMembersCount = members ? members.filter((m) => m.is_active !== false).length : 50; // Fallback to 50 if fetch fails
  const discordMemberCount = 3000;
  return (
    <div className="container mx-auto py-6 px-4 lg:px-8 space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 lg:p-10 shadow-2xl isolate">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/stand.webp"
            alt="Bannière Rose Griffon"
            fill
            className="object-cover"
            priority
          />
          {/* Gradient plus sombre pour assurer la lisibilité */}
          <div className="absolute inset-0 bg-linear-to-r from-[#2f6e9c]/95 to-[#1a4c70]/90 mix-blend-multiply" />
          <div className="absolute inset-0 bg-black/50" />
        </div>

        {/* Background Effects */}
        <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none z-0" style={{ backgroundImage: "url(/images/noise.svg)" }} />

        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border backdrop-blur-md mb-4">
            <Sparkles className="size-4 text-[#FECD50] animate-pulse" />
            <span className="text-white font-medium text-sm uppercase tracking-wide">
              Recrutement Ouvert
            </span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mb-4 text-white tracking-tight font-[family-name:var(--font-poppins)] drop-shadow-lg">
            Rejoignez l'aventure <br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-white to-white/80">
              Rose Griffon
            </span>
          </h1>

          <p className="text-lg md:text-xl text-blue-50/95 max-w-2xl mb-6 leading-relaxed font-semibold drop-shadow-md font-[family-name:var(--font-lato)]">
            Une association dynamique et passionnée qui recherche constamment de nouveaux talents.
            Contribuez à l'essor de la communauté Inazuma Eleven en France selon vos disponibilités.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <Button
              asChild
              size="lg"
              className="bg-white text-[#2f6e9c] hover:bg-blue-50 font-bold text-base shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 rounded-xl h-14 px-8"
            >
              <a
                href="https://forms.gle/NK2RkbZa3WzsoHkw5"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3"
              >
                <Image
                  src="/RG_Logo_V2.5.webp"
                  alt="Rose Griffon Logo"
                  width={24}
                  height={24}
                  className="rounded-full"
                />
                Rejoindre Rose Griffon
                <ArrowRight className="size-5" />
              </a>
            </Button>

            <Button
              asChild
              size="lg"
              className="bg-[#C83C51] text-white hover:bg-[#a0283a] font-bold text-base shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 rounded-xl h-14 px-8 border border-border"
            >
              <a
                href="https://forms.gle/cLSGYcF1JAWB83Qn6"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3"
              >
                <Image
                  src="/azale.webp"
                  alt="Azalée Logo"
                  width={24}
                  height={24}
                  className="rounded-full bg-white p-0.5"
                />
                Rejoindre Azalée
                <ArrowRight className="size-5" />
              </a>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-muted backdrop-blur-sm text-white border-border hover:bg-white hover:text-[#2f6e9c] font-bold text-base shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 rounded-xl h-14 px-8"
            >
              <a
                href="https://forms.gle/JjiptG8aQybDnHni8"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3"
              >
                <Shield className="size-5" />
                Équipe Modération
                <ArrowRight className="size-5" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: Users,
            label: "adherents",
            value: activeMembersCount,
            color: "text-blue-500",
            bg: "bg-blue-500/10",
          },
          {
            icon: MessageCircle,
            label: "Membres Discord",
            value: discordMemberCount,
            color: "text-purple-500",
            bg: "bg-purple-500/10",
          },
          {
            icon: MapPin,
            label: "Régions",
            value: "France",
            color: "text-green-500",
            bg: "bg-green-500/10",
          },
          {
            icon: Heart,
            label: "Passion",
            value: "100%",
            color: "text-red-500",
            bg: "bg-red-500/10",
          },
        ].map((stat, index) => (
          <Card
            key={index}
            className="border-none shadow-lg hover:shadow-xl transition-all duration-300 bg-white dark:bg-zinc-900/50 group"
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <div
                className={`p-3 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300`}
              >
                <stat.icon className="size-6" />
              </div>
              <div>
                <p className="text-2xl font-black text-gray-900 dark:text-white mb-0.5">
                  {stat.value}
                </p>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {stat.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Conditions d'intégration */}
        <Card className="border-0 shadow-xl bg-white dark:bg-zinc-900 overflow-hidden h-full flex flex-col">
          <div className="h-1.5 bg-linear-to-r from-[#2f6e9c] to-[#a14b3f]" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-[#2f6e9c]/10 text-[#2f6e9c]">
                <CheckCircle className="size-6" />
              </div>
              <CardTitle className="text-2xl font-bold">Conditions d&apos;intégration</CardTitle>
            </div>
            <CardDescription>Les pré-requis pour rejoindre l&apos;aventure</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-4 grow">
            {[
              {
                text: "Être majeur (18 ans révolus). Cette condition est stricte pour des raisons légales et organisationnelles.",
                highlight: "18 ans minimum",
              },
              {
                text: "Pour l'association Rose Griffon : Être mobile pour les événements IRL (conventions) ou avoir des compétences spécifiques (art, dev, musique).",
                highlight: "Mobilité ou Compétences",
              },
              {
                text: "Pour le média Azalée : Avoir une plume (Rédacteur), savoir gérer des réseaux (CM) ou créer des visuels (Graphiste).",
                highlight: "Plume, Social ou Graphisme",
              },
              {
                text: "Pour la Modération : Avoir de l'expérience dans la gestion de communautés Discord et faire preuve de sang-froid.",
                highlight: "Expérience Discord",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="flex gap-4 p-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors border border-transparent hover:border-blue-100 dark:hover:border-blue-900/30"
              >
                <div className="shrink-0 mt-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-[#2f6e9c]" />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                  {item.text}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Postes Ouverts */}
        <Card className="border-0 shadow-xl bg-white dark:bg-zinc-900 overflow-hidden h-full flex flex-col">
          <div className="h-1.5 bg-linear-to-r from-[#a14b3f] to-[#FECD50]" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-xl bg-[#a14b3f]/10 text-[#a14b3f]">
                <Briefcase className="size-6" />
              </div>
              <CardTitle className="text-2xl font-bold">Postes Ouverts</CardTitle>
            </div>
            <CardDescription>Les rôles que nous recherchons activement</CardDescription>
          </CardHeader>

          <CardContent className="space-y-3 pt-4 grow">
            <div className="group p-4 rounded-xl border border-gray-100 dark:border-zinc-800 hover:border-[#2f6e9c] hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all duration-300">
              <h3 className="text-lg font-bold text-[#2f6e9c] mb-1 flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#2f6e9c]" />
                Rose Griffon (Asso)
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Staff Convention, Artistes, Musiciens, Développeurs, Bricoleurs. Aidez-nous à faire
                vivre la licence IRL et en ligne !
              </p>
            </div>

            <div className="group p-4 rounded-xl border border-gray-100 dark:border-zinc-800 hover:border-[#a14b3f] hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-all duration-300">
              <h3 className="text-lg font-bold text-[#a14b3f] mb-1 flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#a14b3f]" />
                Média Azalée
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                <strong>Rédacteurs</strong>, <strong>Community Managers</strong>,{" "}
                <strong>Graphistes</strong> et <strong>Correcteurs</strong>. Rejoignez l'équipe qui
                couvre l'actualité Inazuma Eleven.
              </p>
            </div>

            <div className="group p-4 rounded-xl border border-gray-100 dark:border-zinc-800 hover:border-[#FECD50] hover:bg-yellow-50/50 dark:hover:bg-yellow-900/10 transition-all duration-300">
              <h3 className="text-lg font-bold text-amber-600 dark:text-[#FECD50] mb-1 flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#FECD50]" />
                Modération
              </h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">
                Gardiens de la communauté Discord. Expérience requise pour maintenir un
                environnement sain et bienveillant.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processus de candidature */}
      <div className="py-8">
        <div className="text-center max-w-3xl mx-auto mb-8 space-y-3">
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white">
            Comment nous rejoindre ?
          </h2>
          <p className="text-lg text-muted-foreground">
            Un processus simple et transparent en 3 étapes
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-0.5 bg-linear-to-r from-gray-200 via-[#2f6e9c] to-gray-200 dark:from-gray-800 dark:to-gray-800 z-0" />

          {[
            {
              step: "01",
              icon: Mail,
              title: "Candidature",
              description: "Remplissez le formulaire en ligne avec vos motivations.",
              color: "text-blue-500",
              bg: "bg-blue-500/10",
            },
            {
              step: "02",
              icon: Users,
              title: "Entretien",
              description: "Échange convivial avec un responsable pour faire connaissance.",
              color: "text-purple-500",
              bg: "bg-purple-500/10",
            },
            {
              step: "03",
              icon: Award,
              title: "Intégration",
              description: "Bienvenue ! Vous recevez vos accès et rejoignez l'équipe.",
              color: "text-green-500",
              bg: "bg-green-500/10",
            },
          ].map((item, index) => (
            <div key={index} className="relative z-10 group">
              <div className="flex flex-col items-center text-center p-6 rounded-3xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300">
                <div
                  className={`size-14 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner`}
                >
                  <item.icon className="size-7" />
                </div>
                <span className="text-xs font-bold text-muted-foreground mb-2 opacity-50">
                  ÉTAPE {item.step}
                </span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div
        id="candidature"
        className="relative overflow-hidden rounded-3xl bg-[#a14b3f] p-6 md:p-10 shadow-2xl text-center isolate"
      >
        <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none" style={{ backgroundImage: "url(/images/noise.svg)" }} />
        <div className="absolute top-0 right-0 size-96 bg-[#FECD50] rounded-full blur-[150px] opacity-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 size-96 bg-[#2f6e9c] rounded-full blur-[150px] opacity-30 pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white tracking-tight">
            Prêt à écrire l'histoire avec nous ?
          </h2>

          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto leading-relaxed font-medium">
            Que vous soyez artiste, organisateur, développeur ou simplement passionné, il y a une
            place pour vous chez Rose Griffon.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button
              asChild
              size="lg"
              className="bg-white text-[#a14b3f] hover:bg-red-50 font-bold text-lg h-16 px-10 rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:scale-105"
            >
              <a
                href="https://forms.gle/NK2RkbZa3WzsoHkw5"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3"
              >
                <Image
                  src="/RG_Logo_V2.5.webp"
                  alt="Rose Griffon Logo"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
                Candidater maintenant
                <ArrowRight className="size-6" />
              </a>
            </Button>

            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-black/20 backdrop-blur-md text-white border-border hover:bg-muted font-bold text-lg h-16 px-8 rounded-2xl transition-all hover:scale-105"
            >
              <a
                href="https://forms.gle/JjiptG8aQybDnHni8"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3"
              >
                <Shield className="size-6" />
                Devenir Modérateur
              </a>
            </Button>
          </div>

          <p className="text-muted-foreground text-sm font-medium flex items-center justify-center gap-2">
            <span className="size-2 rounded-full bg-green-400 animate-pulse" />
            Réponse sous 48h en moyenne
          </p>
        </div>
      </div>
    </div>
  );
}