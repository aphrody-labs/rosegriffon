import { Button, Card, CardContent } from "@rose-griffon/ui";
import { Newspaper } from "lucide-react";
import Image from "next/image";

import { Twitter } from "@/lib/icons-config";
import { InstagramIcon as Instagram } from "@/shared/icons/instagram";

export interface AzaleeBannerProps {
  title?: string;
  tag?: string;
  description?: string;
  image?: string;
  logo?: string;
  twitterLink?: string;
  instagramLink?: string;
}

export function AzaleeBanner({
  title = "AZALÉE",
  tag = "Actualités",
  description = "Le pilier médiatique de Rose Griffon. Ne ratez aucune info sur Victory Road : traductions exclusives, interviews, analyses et couverture complète de l'actualité de la licence.",
  image = "/azalee-bg.webp",
  logo = "/RG_Azalee-logo.webp",
  twitterLink = "https://x.com/Azalee_IE",
  instagramLink = "https://www.instagram.com/azaleefr/",
}: AzaleeBannerProps) {
  return (
    <div className="w-full">
      <Card className="overflow-hidden border border-[#b78250] border-t-0 shadow-[0_0_40px_-10px_rgba(200,60,81,0.2)] bg-[#240112] relative group rounded-3xl p-0">
        {/* Soft Paper/Noise Texture effect */}
        <div className="absolute inset-0 opacity-10 mix-blend-overlay pointer-events-none" style={{ backgroundImage: "url(/images/noise.svg)" }} />
        <div className="absolute -right-20 -top-20 size-96 bg-[#C83C51] rounded-full blur-[128px] opacity-20 pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 size-96 bg-[#FECD50] rounded-full blur-[128px] opacity-10 pointer-events-none" />

        <div className="grid md:grid-cols-2 gap-0 relative z-20 md:min-h-[320px] lg:min-h-[360px]">
          {/* Left: Image */}
          <div className="relative h-52 sm:h-64 md:h-auto w-full overflow-hidden">
            <Image
              src={image}
              alt={`Bannière ${title}`}
              fill
              className="object-cover object-center transition-transform duration-700 group-hover:scale-105 group-hover:rotate-1"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>

          {/* Right: Text Content */}
          <CardContent className="px-6 pb-6 pt-0 sm:px-10 sm:pb-10 sm:pt-0 md:p-12 md:pt-0 flex flex-col justify-center space-y-6 bg-transparent relative">
            <div className="space-y-4">
              <div className="flex items-center justify-between w-full">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#FECD50]/10 border border-[#FECD50]/30 text-[#FECD50] text-xs font-bold uppercase tracking-wide shadow-sm">
                  <Newspaper className="size-3 fill-[#FECD50]" />
                  {tag}
                </div>
                <div className="relative size-12 sm:w-16 sm:h-16 shrink-0">
                  <Image
                    src={logo}
                    alt={`Logo ${title} Miniature`}
                    fill
                    className="object-contain drop-shadow-sm"
                  />
                </div>
              </div>
              <h2
                className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white"
                style={{ fontFamily: '"BradBunR", system-ui' }}
              >
                <span className="bg-clip-text text-transparent bg-linear-to-r from-[#FECD50] to-[#C83C51] drop-shadow-sm">
                  {title}
                </span>
              </h2>
            </div>

            <p className="text-gray-300 text-base sm:text-lg leading-relaxed max-w-md font-light">
              {description}
            </p>

            <div className="flex flex-wrap gap-3 pt-0">
              <Button
                asChild
                size="lg"
                className="bg-white hover:bg-gray-100 text-[#240112] font-bold rounded-full shadow-lg hover:shadow-white/20 transition-all duration-300 px-5 text-sm sm:text-base"
              >
                <a href={twitterLink} target="_blank" rel="noopener noreferrer">
                  <Twitter className="mr-2 size-4 sm:w-5 sm:h-5 fill-current" />
                  Suivre sur X
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-[#C83C51] text-[#FECD50] hover:bg-[#C83C51]/20 hover:text-white hover:border-[#FECD50] rounded-full backdrop-blur-sm bg-[#240112]/50 transition-all duration-300 px-5 text-sm sm:text-base"
              >
                <a href={instagramLink} target="_blank" rel="noopener noreferrer">
                  <Instagram className="mr-2 size-4 sm:w-5 sm:h-5" />
                  Instagram
                </a>
              </Button>
            </div>
          </CardContent>
        </div>
      </Card>
    </div>
  );
}