/**
 * Cdn-loader.js — passthrough vers cdn.rosegriffon.fr (azalee)
 *
 * Activé via next.config.ts si NEXT_PUBLIC_CDN_URL est défini :
 *   images: { loader: 'custom', loaderFile: './cdn-loader.js' }
 *
 * Comportement :
 *   - src commence par "/" → préfixe avec ${CDN}/public${src} (assets public/)
 *   - src absolue (http(s)://) → renvoyée telle quelle (déjà sur le CDN ou ailleurs)
 *
 * Note : on bypass /_next/image — pas de redimensionnement runtime.
 *        Les images servies par nginx static sont déjà encodées en .webp/.avif ;
 *        si besoin de tailles multiples, pré-générer via canvas/sharp côté build.
 *        Le param `width` est ignoré côté CDN nginx mais conservé en query
 *        pour cache-busting si jamais on wire un image-resizer plus tard.
 */
export default function cdnLoader({ src, width, quality }) {
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
