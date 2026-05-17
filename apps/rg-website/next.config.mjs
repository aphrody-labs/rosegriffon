import withBundleAnalyzer from "@next/bundle-analyzer";
import path from "node:path";

const bundleAnalyzer = withBundleAnalyzer({
	enabled: process.env.ANALYZE === "true",
});

// CDN externe — décharge .next/static/ + assets public/ vers cdn.rosegriffon.fr.
// 2 toggles indépendants (build-time) :
//   NEXT_PUBLIC_CDN_URL    → assetPrefix (chunks JS/CSS/fonts)
//   NEXT_PUBLIC_CDN_LOADER → bypass /_next/image (tous <Image> via cdn-loader.js)
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL?.trim() || "";
const CDN_LOADER = CDN_URL && process.env.NEXT_PUBLIC_CDN_LOADER === "1";

// Vercel build : pas de standalone (Vercel package son runtime), pas de tracing root
// (le monorepo root est piloté par vercel.json + Turbo).
const IS_VERCEL = process.env.VERCEL === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
	...(IS_VERCEL
		? {}
		: {
				output: "standalone",
				outputFileTracingRoot: path.join(process.cwd(), "../../"),
			}),

	// Nginx gère gzip — désactiver ici pour éviter le double compress (sans effet sur Vercel).
	compress: false,

	// Préfixe automatiquement /_next/static/* avec le CDN si défini.
	...(CDN_URL && { assetPrefix: CDN_URL }),

	// Turbopack : config vide pour activer Turbopack par défaut
	turbopack: {},

	// Packages workspace ESM — transpile pour éviter les erreurs Next 16 sur les .ts internes.
	transpilePackages: ["@rg/ui", "@rg/db"],

	typescript: {
		ignoreBuildErrors: true,
	},

	// Performance
	productionBrowserSourceMaps: false,

	// Packages Node.js natifs exclus du bundling serveur
	serverExternalPackages: [
		"@sentry/nextjs",
		"@supabase/supabase-js",
		"@supabase/realtime-js",
		"discord.js",
		"googleapis",
		"nodemailer",
		"sharp",
		"pica",
		"xlsx",
	],

	experimental: {
		// Cache Turbopack persistant entre builds (gain 2-5x sur incremental).
		turbopackFileSystemCacheForBuild: true,
		// Minification CSS via Lightning CSS (Rust).
		optimizeCss: true,
		// Turbopack optimise automatiquement les barrel files,
		// mais on garde la liste explicite pour le fallback webpack (analyze, etc.)
		optimizePackageImports: [
			"lucide-react",
			"date-fns",
			"framer-motion",
			"react-hook-form",
			"zustand",
			"@tanstack/react-query",
			"@tanstack/react-table",
			"@tiptap/core",
			"@tiptap/react",
			"@tiptap/starter-kit",
			"clsx",
			"tailwind-merge",
			"class-variance-authority",
			"sonner",
			"zod",
		],
		serverActions: {
			bodySizeLimit: "5mb",
		},
		viewTransition: true,
	},

	// Suppression des console.log en production (garde error + warn)
	compiler: {
		removeConsole:
			process.env.NODE_ENV === "production"
				? {
						exclude: ["error", "warn"],
					}
				: false,
	},

	async redirects() {
		return [
			{
				source: "/azalee",
				destination: "https://x.com/Azalee_IE",
				permanent: true,
			},
			{
				source: "/a-propos/soutenir",
				destination: "/nous-soutenir",
				permanent: true,
			},
		];
	},

	async headers() {
		return [
			{
				source: "/(.*)",
				headers: [
					{
						key: "Cross-Origin-Opener-Policy",
						value: "same-origin-allow-popups",
					},
				],
			},
			{
				source: "/api/public/:path*",
				headers: [
					{ key: "Access-Control-Allow-Credentials", value: "true" },
					{ key: "Access-Control-Allow-Origin", value: "*" },
					{
						key: "Access-Control-Allow-Methods",
						value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
					},
					{
						key: "Access-Control-Allow-Headers",
						value:
							"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
					},
				],
			},
			{
				source: "/projets/noel",
				headers: [
					{
						key: "Content-Security-Policy",
						value:
							"frame-ancestors * https://discord.com https://*.discord.com https://discordapp.com;",
					},
					{
						key: "X-Frame-Options",
						value: "ALLOWALL",
					},
				],
			},
			{
				source: "/fonts/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
			{
				source: "/_next/static/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
			},
			{
				source: "/noel/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=3600, must-revalidate",
					},
				],
			},
			{
				source: "/RG_Logo_V2.5.webp",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=86400, must-revalidate",
					},
				],
			},
			{
				source: "/images/:path*",
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=3600, must-revalidate",
					},
				],
			},
		];
	},
	images: {
		formats: ["image/avif", "image/webp"],
		deviceSizes: [640, 828, 1080, 1920, 2048],
		imageSizes: [32, 64, 128, 256, 384],
		minimumCacheTTL: 86400,
		qualities: [75, 85],
		unoptimized: false,
		// Loader custom CDN passthrough — actif si NEXT_PUBLIC_CDN_LOADER=1.
		...(CDN_LOADER && {
			loader: "custom",
			loaderFile: "./cdn-loader.js",
		}),
		remotePatterns: [
			{ protocol: "https", hostname: "cdn.rosegriffon.fr" },
			{ protocol: "https", hostname: "placehold.co" },
			{ protocol: "https", hostname: "rosegriffon.fr" },
			{ protocol: "https", hostname: "cdn.discordapp.com" },
			{ protocol: "https", hostname: "static-cdn.jtvnw.net" },
			{ protocol: "https", hostname: "pbs.twimg.com" },
			{ protocol: "https", hostname: "abs.twimg.com" },
			{ protocol: "https", hostname: "dxi4wb638ujep.cloudfront.net" },
		],
		dangerouslyAllowSVG: true,
		contentDispositionType: "attachment",
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
	},
};

export default bundleAnalyzer(nextConfig);
