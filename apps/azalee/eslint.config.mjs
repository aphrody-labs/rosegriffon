// Étend la config Next partagée @rose-griffon/config/eslint-nextjs.mjs et y ajoute les overrides spécifiques azalee.
// - quotes/semi/explicit-any/etc. — règles azalee historiques
// - ignores : modules legacy/generated inagle, scripts/, data/, public/, etc.
// - better-tailwindcss entryPoint = app/globals.css (PAS src/app/globals.css)
//   sinon ~60 false positives sur tokens M3 custom (`bg-error-container`, …).
import { defineConfig, globalIgnores } from "eslint/config";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import jsxA11y from "eslint-plugin-jsx-a11y";
import oxlint from "eslint-plugin-oxlint";
import reactCompiler from "eslint-plugin-react-compiler";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
	...nextVitals,
	...nextTs,
	{ rules: jsxA11y.flatConfigs.strict.rules },
	reactCompiler.configs.recommended,
	{
		rules: {
			semi: ["error", "always"],
			quotes: ["error", "double", { avoidEscape: true }],
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{ args: "none", varsIgnorePattern: "^_", ignoreRestSiblings: true },
			],
			"@typescript-eslint/no-explicit-any": "warn",
			"react-hooks/rules-of-hooks": "error",
			"react-hooks/exhaustive-deps": "error",
			"react-hooks/set-state-in-effect": "warn",
			"@next/next/no-img-element": "error",
			"react/no-unescaped-entities": ["error"],
			"no-console": ["warn", { allow: ["warn", "error"] }],
			"jsx-a11y/label-has-associated-control": ["error", { assert: "either" }],
		},
	},
	globalIgnores([
		".next/**",
		"out/**",
		"build/**",
		"dist/**",
		".turbo/**",
		"next-env.d.ts",
		"node_modules/**",
		"scripts/**",
		"data/**",
		"public/**",
		"lib/inagle/_cli_ignore/**",
		"lib/inagle/_scripts_ignore/**",
		"prisma/generated/**",
		"update-locales*.js",
		"types/database.types.ts",
		"src/lib/inagle/types/database.ts",
		"src/lib/inagle/data/**",
		"src/lib/inagle/core/gamedata.ts",
		"src/lib/inagle/parsers/**",
		"src/lib/inagle/skills/mapper-passive.ts",
		"**/*.min.js",
		"**/*.map",
	]),
	{
		files: ["**/*.{ts,tsx,jsx}"],
		plugins: { "better-tailwindcss": betterTailwindcss },
		settings: {
			"better-tailwindcss": {
				entryPoint: "app/globals.css",
			},
		},
		rules: {
			...betterTailwindcss.configs["recommended-warn"].rules,
		},
	},
	// Oxlint — disable ESLint rules already covered by oxlint (must be LAST)
	...oxlint.configs["flat/recommended"],
]);

export default eslintConfig;
