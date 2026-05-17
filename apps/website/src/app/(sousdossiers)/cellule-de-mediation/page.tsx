import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Scale, Shield, Users } from "@/lib/icons-config";

export default function RejoindreRGPage() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
      {/* Hero Section */}
      <div className="bg-gaelle-blue text-white py-16 mb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl lg:text-6xl font-bold mb-6">Cellule de Médiation</h1>
            <p className="text-xl lg:text-2xl text-blue-100 max-w-2xl mx-auto">
              Un espace neutre, confidentiel et indépendant pour le bien-être de tous les membres.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-16">
        {/* Introduction */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
            <h2 className="text-2xl lg:text-3xl font-bold mb-6 text-gaelle-blue dark:text-blue-400 flex items-center gap-3">
              <Shield className="w-8 h-8" />
              Qu&apos;est-ce que la cellule de médiation RG ?
            </h2>
            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed text-justify">
              La cellule de médiation RG est une structure interne à l’association Rose Griffon,
              fonctionnant de manière{" "}
              <span className="font-semibold text-gaelle-blue dark:text-blue-400">
                totalement indépendante
              </span>{" "}
              du staff dirigeant. Elle a été créée pour garantir un espace neutre et impartial, une
              écoute confidentielle hors de la chaîne de commandement habituelle, et une gestion
              autonome des conflits.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Missions Card */}
          <Card className="border-t-4 border-t-gaelle-blue shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-3 text-2xl lg:text-3xl text-gray-800 dark:text-gray-100">
                <Scale className="w-8 h-8 text-gaelle-blue" />
                Ses missions principales
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
              <div className="flex gap-4 items-start p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="bg-gaelle-blue text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold">
                  1
                </div>
                <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300">
                  <span className="font-semibold block mb-1 text-gray-900 dark:text-white">
                    Contact direct & confidentiel
                  </span>
                  Les membres peuvent contacter la cellule via une adresse mail dédiée pour tout
                  sujet : conflits internes, harcèlement, ou problèmes affectant la vie associative.
                </p>
              </div>

              <div className="flex gap-4 items-start p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="bg-gaelle-blue text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold">
                  2
                </div>
                <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300">
                  <span className="font-semibold block mb-1 text-gray-900 dark:text-white">
                    Écoute & Dialogue
                  </span>
                  La cellule agit comme tiers de confiance pour organiser un dialogue neutre et
                  respectueux, cherchant une solution amiable pour préserver l&apos;ambiance
                  générale.
                </p>
              </div>

              <div className="flex gap-4 items-start p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                <div className="bg-gaelle-blue text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0 font-bold">
                  3
                </div>
                <p className="text-base lg:text-lg text-gray-700 dark:text-gray-300">
                  <span className="font-semibold block mb-1 text-gray-900 dark:text-white">
                    Autonomie décisionnelle
                  </span>
                  Elle gère ses équipes de façon autonome. Si nécessaire et avec l&apos;accord de la
                  victime, elle peut remonter les informations aux instances compétentes pour
                  décision officielle.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Card */}
          <Card className="border-t-4 border-t-amber-500 shadow-lg hover:shadow-xl transition-shadow duration-300 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl lg:text-3xl text-gray-800 dark:text-gray-100">
                <Users className="w-8 h-8 text-amber-500" />
                Besoin d&apos;en parler ?
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <p className="mb-8 text-lg text-gray-600 dark:text-gray-400 max-w-md">
                L&apos;équipe de médiation est là pour vous écouter en toute bienveillance et
                confidentialité. N&apos;hésitez pas à nous contacter.
              </p>

              <div className="relative w-64 h-64 mb-8 animate-in fade-in zoom-in duration-700">
                <Image
                  src="/emote.webp"
                  alt="Médiation Rose Griffon"
                  fill
                  sizes="(max-width: 768px) 100vw, 300px"
                  className="object-contain drop-shadow-xl"
                />
              </div>

              <Button
                asChild
                size="lg"
                className="w-full max-w-sm text-lg h-14 bg-amber-500 hover:bg-amber-600 text-white shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1"
              >
                <a
                  href="mailto:Rosegriffon.mediation@Gmail.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3"
                >
                  <Mail className="w-6 h-6" />
                  Contacter la cellule
                </a>
              </Button>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Réponse sous 48h ouvrées
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
