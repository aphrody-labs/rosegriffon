import type { NextConfig } from "next";
import path from "node:path";

const IS_VERCEL = process.env.VERCEL === "1";

// CDN externe — décharge .next/static/ + assets public/ vers cdn.rosegriffon.fr.
// 2 toggles indépendants (build-time, NEXT_PUBLIC_*) :
//   NEXT_PUBLIC_CDN_URL=https://cdn.rosegriffon.fr/static/azalee  → assetPrefix (chunks JS/CSS/fonts)
//   NEXT_PUBLIC_CDN_LOADER=1                                       → bypass /_next/image (tous <Image> via cdn-loader.js)
// Vide → comportement legacy (assets servis depuis l'origin Next).
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL?.trim() || "";
const CDN_ORIGIN = CDN_URL ? new URL(CDN_URL).origin : "";
const CDN_LOADER = CDN_URL && process.env.NEXT_PUBLIC_CDN_LOADER === "1";

const nextConfig: NextConfig = {
	poweredByHeader: false,

	// Nginx gere la compression (gzip) — desactiver ici pour eviter le double compress
	compress: false,

	// assetPrefix : Next préfixe TOUTES les URLs /_next/static/* avec CDN_URL.
	// Les assets public/ restent référencés par path relatif → conserver miroir local OU
	// remplacer manuellement par `${CDN_URL}/public/...` côté composants.
	...(CDN_URL && { assetPrefix: CDN_URL }),

	// React Compiler — memoization automatique (stable en Next.js 16)
	reactCompiler: true,

	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "cdn.rosegriffon.fr",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "dxi4wb638ujep.cloudfront.net",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "www.inazuma.jp",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "zukan.inazuma.jp",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "inazuma.jp",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "mpfpbojuqtbjpehwlwfp.supabase.co",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "lh3.googleusercontent.com",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "cdn.discordapp.com",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "pbs.twimg.com",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "azalee.rosegriffon.fr",
				pathname: "/storage/**",
			},
		],
		contentDispositionType: "attachment",
		qualities: [75, 90, 100],
		formats: ["image/avif", "image/webp"],
		// Restreint les widths du srcset pour matcher notre cache disque G4TX (256/384/512/768/1024).
		// Defaults Next sont [16, 32, 48, 64, 96, 128, 256, 384] (imageSizes)
		// + [640, 750, 828, 1080, 1200, 1920, 2048, 3840] (deviceSizes) → 14 widths,
		// trop de variants a pre-warm. On reduit a 6 widths totaux qui couvrent
		// les usages : icones (96px), thumbs grille (256-512), full screen (1024+).
		imageSizes: [96, 256, 384, 512],
		deviceSizes: [768, 1024, 1920],
		minimumCacheTTL: 86400, // 24h cache pour images optimisees (defaut: 60s)
		// Loader custom CDN passthrough — actif si NEXT_PUBLIC_CDN_LOADER=1.
		// Bypass /_next/image (pas de redim runtime) ; nginx sert les assets tels quels.
		...(CDN_LOADER && {
			loader: "custom",
			loaderFile: "./cdn-loader.js",
		}),
	},

	// Output standalone pour systemd VPS — Vercel package son runtime.
	...(IS_VERCEL
		? {}
		: {
				output: "standalone" as const,
				outputFileTracingRoot: path.resolve(__dirname, "../../"),
				turbopack: {
					root: path.resolve(__dirname, "../../"),
				},
			}),
	transpilePackages: ["@rosegriffon/inagle", "@rg/ui", "@rg/db"],

	// Packages Node.js natifs exclus du bundling serveur
	serverExternalPackages: [
		"better-auth",
		"pg",
		"sharp",
		"nodemailer",
		"cheerio",
		"bcryptjs",
		"jsonwebtoken",
		"googleapis",
		"web-push",
		"konva",
		"csv-parse",
	],

	logging:
		process.env.NODE_ENV === "production"
			? { fetches: { fullUrl: false } }
			: { fetches: { fullUrl: true } },

	typescript: {
		// Type-check géré par `bun run type-check` en CI (tsc --noEmit).
		// Le build Next 16 re-vérifie nativement avec TS 6.0.3.
		ignoreBuildErrors: false,
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
				source: "/dashboard/news/edit",
				destination: "/dashboard/news/new",
				permanent: true,
			},
			{
				source: "/compare",
				destination: "/tools/compare",
				permanent: true,
			},
			{
				source: "/random-team",
				destination: "/tools/random-team",
				permanent: true,
			},
		];
	},

	async rewrites() {
		const supabaseInternal =
			process.env.SUPABASE_INTERNAL_URL ||
			process.env.NEXT_PUBLIC_SUPABASE_URL ||
			"https://isbkaeltubqittywibeh.supabase.co";
		return [
			{
				source: "/storage/v1/:path*",
				destination: `${supabaseInternal}/storage/v1/:path*`,
			},
			{
				source: "/zukan/assets/:path*",
				destination: "https://azalee.rosegriffon.fr/zukan-assets-mirror/:path*",
			},
		];
	},

	async headers() {
		const isDev = process.env.NODE_ENV === "development";

		const cdnSrc = CDN_ORIGIN ? ` ${CDN_ORIGIN}` : "";

		const cspHeader = [
			"default-src 'self'",
			`script-src 'self' 'unsafe-inline'${cdnSrc} https://www.googletagmanager.com https://www.google-analytics.com${isDev ? " 'unsafe-eval'" : ""}`,
			`style-src 'self' 'unsafe-inline'${cdnSrc}`,
			`img-src 'self' blob: data:${cdnSrc} https://dxi4wb638ujep.cloudfront.net https://*.inazuma.jp https://*.supabase.co https://lh3.googleusercontent.com https://cdn.discordapp.com https://pbs.twimg.com`,
			`media-src 'self' blob: data:${cdnSrc} https://dxi4wb638ujep.cloudfront.net https://*.inazuma.jp`,
			`font-src 'self'${cdnSrc}`,
			`connect-src 'self'${cdnSrc} https://www.google-analytics.com https://www.googletagmanager.com https://*.supabase.co wss://*.supabase.co`,
			"frame-src 'none'",
			"frame-ancestors 'none'",
			"base-uri 'self'",
			"form-action 'self'",
			"upgrade-insecure-requests",
		].join("; ");

		return [
			{
				source: "/(.*)",
				headers: [
					{
						key: "X-Content-Type-Options",
						value: "nosniff",
					},
					{
						key: "X-Frame-Options",
						value: "DENY",
					},
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=63072000; includeSubDomains; preload",
					},
					{
						key: "Content-Security-Policy",
						value: cspHeader,
					},
					{
						key: "X-DNS-Prefetch-Control",
						value: "on",
					},
				],
			},
		];
	},

	experimental: {
		viewTransition: true,
		// Cache Turbopack persistant entre builds (gain 2-5x)
		turbopackFileSystemCacheForBuild: true,
		// Minification CSS via Lightning CSS
		optimizeCss: true,
		// Turbopack optimise automatiquement les barrel files,
		// mais on garde la liste pour le fallback webpack
		optimizePackageImports: [
			"lucide-react",
			"date-fns",
			"recharts",
			"react-hook-form",
			"zod",
			"clsx",
			"tailwind-merge",
			"class-variance-authority",
			"sonner",
			"cmdk",
			"@lexical/react",
			"lexical",
			"@dnd-kit/core",
			"@dnd-kit/sortable",
			"@dnd-kit/utilities",
			"graphql",
			"graphql-yoga",
			"@radix-ui/react-accordion",
			"@radix-ui/react-alert-dialog",
			"@radix-ui/react-avatar",
			"@radix-ui/react-checkbox",
			"@radix-ui/react-collapsible",
			"@radix-ui/react-dialog",
			"@radix-ui/react-dropdown-menu",
			"@radix-ui/react-label",
			"@radix-ui/react-popover",
			"@radix-ui/react-progress",
			"@radix-ui/react-radio-group",
			"@radix-ui/react-select",
			"@radix-ui/react-separator",
			"@radix-ui/react-slider",
			"@radix-ui/react-slot",
			"@radix-ui/react-switch",
			"@radix-ui/react-tabs",
			"@radix-ui/react-toggle",
			"@radix-ui/react-toggle-group",
			"@radix-ui/react-tooltip",
		],
		serverActions: {
			bodySizeLimit: "10mb",
		},
	},
};

export default nextConfig;
