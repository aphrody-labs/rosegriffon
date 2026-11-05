"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { videoLisibleNavigateur } from "@/lib/x-campagnes/video";

/*
 * Vignette d'une participation VIDÉO : rien n'est téléchargé avant le geste.
 *
 * ⚠ `preload="metadata"` NE SUFFISAIT PAS. Les pièces jointes Discord sont servies
 * brutes (28 Mo de `.mp4`, 27 Mo de `.mov`) et un MP4 dont l'atome `moov` est en fin de
 * fichier oblige le navigateur à lire loin pour trouver « l'en-tête » : la page
 * `/iergday?campagne=inazuma-rg-2` pesait 55 Mo au chargement (audit du 5/11/2026).
 *
 * Trois verrous, du plus fort au plus faible :
 *   1. un conteneur non web (`.mov`) n'est jamais monté (`videoLisibleNavigateur`) ;
 *   2. la balise n'existe dans le DOM qu'une fois la carte proche de l'écran ;
 *   3. elle porte alors `preload="none"` : seul le survol (`play()`) lance le flux.
 *
 * L'aplat et son pictogramme sont TOUJOURS peints dessous : une `<video>` sans
 * image chargée est transparente, la case garde donc sa forme et son sens sans
 * affiche (Discord n'en fournit pas) et sans décalage de mise en page.
 */
export function VignetteVideo({ src, ariaLabel }: { src: string; ariaLabel: string }) {
  const lisible = videoLisibleNavigateur(src);
  const boite = useRef<HTMLDivElement>(null);
  const [proche, setProche] = useState(false);

  useEffect(() => {
    const element = boite.current;
    if (!lisible || !element || proche) {
      return;
    }
    const observateur = new IntersectionObserver(
      entrees => {
        if (entrees.some(entree => entree.isIntersecting)) {
          setProche(true);
          observateur.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [lisible, proche]);

  return (
    <div ref={boite} className="relative size-full">
      <div className="flex size-full items-center justify-center bg-surface-container-high text-on-surface-variant">
        <Play className="size-10" aria-hidden />
      </div>
      {lisible && proche && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={src}
          muted
          loop
          playsInline
          preload="none"
          aria-label={ariaLabel}
          className="absolute inset-0 size-full object-cover transition-transform duration-500 motion-safe:group-hover:scale-105"
          onMouseEnter={evenement => {
            void evenement.currentTarget.play().catch(() => {});
          }}
          onMouseLeave={evenement => {
            evenement.currentTarget.pause();
            evenement.currentTarget.currentTime = 0;
          }}
        />
      )}
    </div>
  );
}
