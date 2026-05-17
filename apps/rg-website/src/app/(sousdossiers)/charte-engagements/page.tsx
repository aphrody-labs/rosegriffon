// Page statique avec ISR - Revalidate toutes les semaines (charte rarement modifiée)
export const revalidate = 604800; // 1 semaine

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CharteEngagementsPage() {
  return (
    <div className="container mx-auto py-4 px-4">
      <h1 className="text-4xl lg:text-5xl font-bold mb-6">Charte d&apos;engagements</h1>

      <div className="prose max-w-none mb-12">
        <h2 className="text-2xl lg:text-3xl font-bold mb-4">
          Rose Griffon, Achilléa et Azalée s&apos;engagent à respecter et promouvoir les valeurs
          suivantes dans toutes leurs activités et productions.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Crédit systématique */}
          <Card className="border-l-8 border-l-[#2f6e9c] shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-2xl lg:text-3xl">
                Crédit systématique des productions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base lg:text-lg">
                Nous nous engageons à créditer toutes les personnes ayant contribué à nos projets :
                artistes, développeurs, compositeurs, organisateurs, etc. Chaque travail mérite
                d&apos;être reconnu.
              </p>
            </CardContent>
          </Card>

          {/* Transparence */}
          <Card className="border-l-8 border-l-blue-600 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-2xl lg:text-3xl">
                Transparence sur nos actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base lg:text-lg">
                Chaque projet, chaque action menée est justifiée, expliquée et rendue publique. Nous
                nous engageons à toujours expliciter nos intentions et décisions de manière claire
                et accessible.
              </p>
            </CardContent>
          </Card>

          {/* Refus de l'IA */}
          <Card className="border-l-8 border-l-amber-500 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-2xl lg:text-3xl">
                Refus de l&apos;IA générative comme substitut à la création humaine
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base lg:text-lg">
                Rose Griffon privilégie la création humaine. Nous nous engageons à limiter
                drastiquement l&apos;utilisation d&apos;IA générative (visuelle, sonore, textuelle)
                dans nos productions pour garantir l&apos;authenticité, la qualité et l&apos;éthique
                du travail fourni.
              </p>
            </CardContent>
          </Card>

          {/* Respect et tolérance */}
          <Card className="border-l-8 border-l-blue-600 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-2xl lg:text-3xl">
                Respect et tolérance inconditionnels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base lg:text-lg">
                Rose Griffon est une structure inclusive. Nous défendons activement le respect de
                toutes les identités (LGBTQIA+, croyances religieuses, origines, genres) et nous
                nous engageons à intervenir fermement contre tout comportement discriminatoire.
              </p>
            </CardContent>
          </Card>

          {/* Finalité commune */}
          <Card className="border-l-8 border-l-red-500 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-2xl lg:text-3xl">
                Une finalité commune : faire grandir la communauté Inazuma Eleven
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base lg:text-lg">
                Tous nos projets - qu&apos;ils soient bénévoles ou rémunérateurs - ont un seul but :
                soutenir, rassembler et faire prospérer la communauté Inazuma Eleven. Même nos
                revenus sont réinvestis pour développer la scène, financer des projets et faire
                émerger de nouveaux talents.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section Partenariats */}
      <div className="prose max-w-none mb-12">
        <h2 className="text-4xl lg:text-5xl font-bold mb-6">
          Partenariat avec l&apos;ensemble des projets Rose Griffon
        </h2>
        <p className="mb-4 text-base lg:text-lg font-bold">(Rose Griffon, Achilléa, Azalée).</p>

        <Card className="border-l-8 border-l-red-600 shadow-lg">
          <CardHeader>
            <CardTitle className="text-2xl lg:text-3xl font-bold">
              Les partenariats ne seront pas acceptés avec des projets qui :
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-6">
              <div className="flex items-start gap-3">
                <div className="min-w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">
                  1
                </div>
                <p className="text-base lg:text-lg">
                  Tolèrent un salon <span className="font-bold">NSFW</span> ou équivalent.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="min-w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">
                  2
                </div>
                <p className="text-base lg:text-lg">
                  Ont une <span className="font-bold">modération laxiste</span> face aux{" "}
                  <span className="font-bold">discriminations</span>,{" "}
                  <span className="font-bold">agressions</span> ou autres cas d&apos;
                  <span className="font-bold">abus</span>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="min-w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">
                  3
                </div>
                <p className="text-base lg:text-lg">
                  Utilisent des outils liés à des personnes reconnues comme{" "}
                  <span className="font-bold">nuisibles</span> pour certaines{" "}
                  <span className="font-bold">communautés</span>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <div className="min-w-6 h-6 rounded-full bg-red-600 flex items-center justify-center text-white font-bold">
                  4
                </div>
                <p className="text-base lg:text-lg">
                  Dépendent fortement d&apos;
                  <span className="font-bold">IA générative artistique</span>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
