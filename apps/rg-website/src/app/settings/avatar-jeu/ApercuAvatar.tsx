"use client";

/**
 * Aperçu 3D réel d'un avatar `chara_edit` : le GLB assemblé par `aphrody-nie-model-serve`
 * (route `/model-avatar/…` du CDN), affiché par `<model-viewer>`.
 *
 * Le cadrage vise le buste, comme le rond du profil : il est calculé sur les dimensions réelles du
 * modèle chargé. L'instantané enregistré est la vue affichée (on peut la faire pivoter avant).
 */

import { Button } from "@rosegriffon/ui/button";
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

import { loadModelViewer } from "@/lib/model-viewer-loader";

type Vecteur = { x: number; y: number; z: number };
type Viewer = HTMLElement & {
  toBlob: (options?: { mimeType?: string; idealAspect?: boolean }) => Promise<Blob>;
  getDimensions: () => Vecteur;
  getBoundingBoxCenter: () => Vecteur;
  updateComplete: Promise<boolean>;
};

export type ApercuAvatarHandle = {
  /** Instantané PNG carré (côté fixe) de la vue courante. */
  capturer: (cote: number) => Promise<Blob>;
};

/** Part de la hauteur du modèle visée par le cadrage (tête et épaules) et champ de vision. */
const FENETRE = 0.3;
const CHAMP_DEG = 30;
/** Hauteur du point visé, en part de la hauteur du modèle (haut de la poitrine). */
const VISEE = 0.82;

/** Distance caméra pour qu'une fenêtre verticale de `hauteur` remplisse le champ de vision. */
export function distanceCamera(hauteur: number, champDeg = CHAMP_DEG): number {
  return hauteur / 2 / Math.tan((champDeg * Math.PI) / 360);
}

export function ApercuAvatar({ url, handleRef }: { url: string; handleRef: Ref<ApercuAvatarHandle> }) {
  const hote = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [instance, setInstance] = useState<Viewer | null>(null);
  const [etat, setEtat] = useState<"chargement" | "pret" | "erreur">("chargement");
  const [essai, setEssai] = useState(0);

  useImperativeHandle(
    handleRef,
    () => ({
      async capturer(cote: number) {
        const mv = viewer.current;
        if (!mv || typeof mv.toBlob !== "function") throw new Error("Aperçu indisponible.");
        await mv.updateComplete;
        const brut = await mv.toBlob({ mimeType: "image/png", idealAspect: false });
        // Recadrage carré centré puis mise à l'échelle : l'image du profil est un carré.
        const bitmap = await createImageBitmap(brut);
        const source = Math.min(bitmap.width, bitmap.height);
        const toile = document.createElement("canvas");
        toile.width = toile.height = cote;
        const ctx = toile.getContext("2d");
        if (!ctx) throw new Error("Capture impossible.");
        ctx.drawImage(
          bitmap,
          (bitmap.width - source) / 2,
          (bitmap.height - source) / 2,
          source,
          source,
          0,
          0,
          cote,
          cote,
        );
        bitmap.close();
        return await new Promise<Blob>((resolve, reject) =>
          toile.toBlob(b => (b ? resolve(b) : reject(new Error("Capture impossible."))), "image/png"),
        );
      },
    }),
    [],
  );

  useEffect(() => {
    let annule = false;
    let element: Viewer | null = null;
    setEtat("chargement");
    loadModelViewer()
      .then(() => {
        if (annule || !hote.current) return;
        const mv = document.createElement("model-viewer") as Viewer;
        element = mv;
        for (const [nom, valeur] of Object.entries({
          alt: "Aperçu 3D de l'avatar du jeu",
          "camera-controls": "",
          "touch-action": "pan-y",
          "interaction-prompt": "none",
          "field-of-view": `${CHAMP_DEG}deg`,
          "shadow-intensity": "0",
        }))
          mv.setAttribute(nom, valeur);
        mv.style.cssText = "width:100%;height:100%";
        mv.addEventListener("load", () => {
          // Cadrage sur le buste, d'après les dimensions réelles du modèle.
          const taille = mv.getDimensions();
          const centre = mv.getBoundingBoxCenter();
          const bas = centre.y - taille.y / 2;
          mv.setAttribute("camera-target", `${centre.x}m ${bas + taille.y * VISEE}m ${centre.z}m`);
          mv.setAttribute("camera-orbit", `0deg 85deg ${distanceCamera(taille.y * FENETRE)}m`);
          setEtat("pret");
        });
        mv.addEventListener("error", () => setEtat("erreur"));
        mv.setAttribute("src", url);
        hote.current.appendChild(mv);
        viewer.current = mv;
        setInstance(mv);
      })
      .catch(() => {
        if (!annule) setEtat("erreur");
      });
    return () => {
      annule = true;
      element?.remove();
      if (viewer.current === element) viewer.current = null;
      setInstance(null);
    };
  }, [url, essai]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={hote}
        data-pret={instance ? etat : "chargement"}
        className="relative aspect-square w-full max-w-72 overflow-hidden rounded-2xl border border-border bg-muted"
      />
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        {etat === "chargement" && "Assemblage du modèle 3D…"}
        {etat === "pret" && "Fais pivoter le modèle : l'avatar enregistré est la vue affichée."}
        {etat === "erreur" && "Assemblage 3D indisponible."}
      </p>
      {etat === "erreur" && (
        <Button variant="outline" className="h-11" onClick={() => setEssai(n => n + 1)}>
          Réessayer
        </Button>
      )}
    </div>
  );
}
