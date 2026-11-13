import type { ImageLoaderProps } from "next/image";
/**
 * Cdn-loader.js — passthrough vers cdn.rosegriffon.fr (website)
 *
 * Activé via next.config.mjs si NEXT_PUBLIC_CDN_URL est défini :
 *   images: { loader: 'custom', loaderFile: './cdn-loader.js' }
 *
 * Comportement :
 *   - src commence par "/" → préfixe avec ${CDN}/public${src} (assets public/)
 *   - src absolue (http(s)://) → renvoyée telle quelle (déjà sur le CDN ou ailleurs)
 *
 * Note : bypass /_next/image — nginx CDN sert les fichiers tels quels (immutable, gzip_static).
 *        Pré-générer les tailles multiples côté build si besoin.
 */
/**
 * Discord sert chaque avatar à la taille demandée (puissance de deux, 16..4096). Un GIF animé
 * est remplacé par du WebP animé (`animated=true`), bien plus léger à qualité égale.
 */
export function discordSized(src: string, width: number): string {
  const url = new URL(src);
  const size = Math.min(
    4096,
    Math.max(16, 2 ** Math.ceil(Math.log2(Math.max(1, width)))),
  );
  if (url.pathname.endsWith(".gif")) {
    url.pathname = url.pathname.replace(/\.gif$/u, ".webp");
    url.searchParams.set("animated", "true");
  }
  url.searchParams.set("size", String(size));
  return url.toString();
}

export default function cdnLoader({
  src,
  width,
  quality,
}: ImageLoaderProps): string {
  if (src.startsWith("https://cdn.discordapp.com/")) {
    return discordSized(src, width);
  }
  const cdn = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdn) {
    return src;
  }
  if (/^https?:\/\//i.test(src)) {
    return src;
  }
  const path = src.startsWith("/") ? src : `/${src}`;
  const q = quality ?? 75;
  return `${cdn}/public${path}?w=${width}&q=${q}`;
}
