import withBundleAnalyzer from "@next/bundle-analyzer";
import path from "node:path";

const bundleAnalyzer = withBundleAnalyzer({
	enabled: process.env.ANALYZE === "true",
});

// CDN externe — décharge .next/static/ + assets public/ vers cdn.rosegriffon.fr.
const CDN_URL = process.env.NEXT_PUBLIC_CDN_URL?.trim() || "";
const CDN_LOADER = CDN_URL && process.env.NEXT_PUBLIC_CDN_LOADER === "1";

const IS_VERCEL = process.env.VERCEL === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
	reactCompiler: true,

	...(IS_VERCEL
		? {
				turbopack: {
					root: path.resolve(process.cwd(), "../../"),
				},
			}
		: {
				output: "standalone",
				outputFileTracingRoot: path.resolve(process.cwd(), "../../"),
				turbopack: {
					root: path.resolve(process.cwd(), "../../"),
				},
			}),

	compress: false,
	...(CDN_URL && { assetPrefix: CDN_URL }),
	transpilePackages: [
		"@rose-griffon/ui",
		"@rose-griffon/db",
		"@rose-griffon/types",
		"@rose-griffon/config",
		"@rose-griffon/patreon-bun",
		"@rose-griffon/auth",
		"@rose-griffon/assets",
	],

	typescript: {
		ignoreBuildErrors: true,
	},

	productionBrowserSourceMaps: false,

	serverExternalPackages: [
		"@sentry/nextjs",
		"discord.js",
		"googleapis",
		"nodemailer",
		"pg",
		"sharp",
		"stripe",
		"pica",
		"xlsx",
	],

	experimental: {
		optimizePackageImports: [
			"lucide-react",
			"date-fns",
			"motion",
			"react-hook-form",
			"@hookform/resolvers",
			"react-icons",
			"recharts",
			"cmdk",
			"vaul",
			"embla-carousel-react",
			"input-otp",
			"react-day-picker",
			"zustand",
			"@tanstack/react-query",
			"@tanstack/react-query-persist-client",
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
		serverSourceMaps: true,
		turbopackFileSystemCacheForBuild: true,
		turbopackFileSystemCacheForDev: true,
		cssChunking: true,
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
			// www → apex : l'auth-client force baseURL=https://rosegriffon.fr (apex) pour
			// que le cookie OAuth `state` et le callback soient sur le même domaine. Sur
			// www.rosegriffon.fr, l'appel /api/auth part donc en cross-origin → bloqué
			// par CORS (« Failed to fetch » au login). On force tout le monde sur l'apex.
			{
				destination: "https://rosegriffon.fr/:path*",
				has: [{ type: "host", value: "www.rosegriffon.fr" }],
				permanent: true,
				source: "/:path*",
			},
			{
				destination: "https://x.com/Azalee_IE",
				permanent: true,
				source: "/azalee",
			},
			{
				destination: "/nous-soutenir",
				permanent: true,
				source: "/a-propos/soutenir",
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
				destination,
				source: "/storage/v1/:path*",
			},
		];
	},

	async headers() {
		return [
			{
				headers: [
					{
						key: "Cross-Origin-Opener-Policy",
						value: "same-origin-allow-popups",
					},
				],
				source: "/(.*)",
			},
			{
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
				source: "/api/public/:path*",
			},
			{
				headers: [
					{
						key: "Cache-Control",
						value: "public, max-age=31536000, immutable",
					},
				],
				source: "/_next/static/:path*",
			},
		];
	},
	images: {
		formats: ["image/avif", "image/webp"],
		unoptimized: false,
		...(CDN_LOADER && {
			loader: "custom",
			loaderFile: "./cdn-loader.ts",
		}),
		remotePatterns: [
			{ hostname: "cdn.rosegriffon.fr", protocol: "https" },
			{ hostname: "placehold.co", protocol: "https" },
			{ hostname: "rosegriffon.fr", protocol: "https" },
			{ hostname: "cdn.discordapp.com", protocol: "https" },
			{ hostname: "static-cdn.jtvnw.net", protocol: "https" },
			{ hostname: "pbs.twimg.com", protocol: "https" },
			{ hostname: "abs.twimg.com", protocol: "https" },
			{ hostname: "dxi4wb638ujep.cloudfront.net", protocol: "https" },
		],
		dangerouslyAllowSVG: true,
		contentDispositionType: "attachment",
		contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
	},
};

export default bundleAnalyzer(nextConfig);
