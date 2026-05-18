import type { NextConfig } from "next";
import path from "node:path";
import { withSentryConfig } from "@sentry/nextjs";

const IS_VERCEL = process.env.VERCEL === "1";

// CDN externe — décharge .next/static/ + assets public/ vers cdn.rosegriffon.fr.
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL?.trim() || "";
const CDN_ORIGIN = CDN_URL ? new URL(CDN_URL).origin : "";
const CDN_LOADER = CDN_URL && process.env.NEXT_PUBLIC_CDN_LOADER === "1";

const nextConfig: NextConfig = {
	poweredByHeader: false,

	// Nginx gere la compression (gzip) — desactiver ici pour eviter le double compress
	compress: false,

	// assetPrefix : Next préfixe TOUTES les URLs /_next/static/* avec CDN_URL.
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
		imageSizes: [96, 256, 384, 512],
		deviceSizes: [768, 1024, 1920],
		minimumCacheTTL: 86400,
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
	transpilePackages: ["@rosegriffon/ui", "@rosegriffon/db"],

	// Packages Node.js natifs exclus du bundling serveur
	serverExternalPackages: [
		"@rosegriffon/inagle",
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
		ignoreBuildErrors: false,
	},

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
		const supabaseUrl =
			process.env.SUPABASE_INTERNAL_URL ||
			process.env.NEXT_PUBLIC_SUPABASE_URL ||
			"https://isbkaeltubqittywibeh.supabase.co";

		// Safety check: ensure destination starts with https://
		const destination = supabaseUrl.startsWith("http")
			? `${supabaseUrl}/storage/v1/:path*`
			: `https://isbkaeltubqittywibeh.supabase.co/storage/v1/:path*`;

		return [
			{
				source: "/storage/v1/:path*",
				destination,
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
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "X-Frame-Options", value: "DENY" },
					{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
					{ key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
					{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
					{ key: "Content-Security-Policy", value: cspHeader },
					{ key: "X-DNS-Prefetch-Control", value: "on" },
				],
			},
		];
	},

	experimental: {
		serverSourceMaps: true,
		viewTransition: false,
		turbopackFileSystemCacheForBuild: true,
		optimizeCss: false,
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

export default withSentryConfig(nextConfig, {
	org: "rose-griffon",
	project: "rg-azalee",
	silent: !process.env.CI,
	widenClientFileUpload: true,
	tunnelRoute: "/monitoring",
});
