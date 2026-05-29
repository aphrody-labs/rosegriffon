import js from "@eslint/js";
import tseslint from "typescript-eslint";
import oxlint from "eslint-plugin-oxlint";

export default [
	js.configs.recommended,
	{
		ignores: [
			"**/node_modules/**",
			"**/.next/**",
			"**/dist/**",
			"**/build/**",
			"**/.turbo/**",
			"**/coverage/**",
			"**/*.d.ts",
		],
	},
	// JS files : default espree parser.
	{
		files: ["**/*.{js,jsx,mjs,cjs}"],
		languageOptions: {
			ecmaVersion: 2024,
			sourceType: "module",
			globals: {
				Bun: "readonly",
				process: "readonly",
				console: "readonly",
			},
		},
		rules: {
			"no-unused-vars": "off",
			"no-undef": "off",
		},
	},
	// TS/TSX files : @typescript-eslint parser, otherwise espree chokes on
	// `interface`, `type`, `as`, generics and JSX (363 parse errors before).
	{
		files: ["**/*.{ts,tsx,mts,cts}"],
		languageOptions: {
			parser: tseslint.parser,
			ecmaVersion: 2024,
			sourceType: "module",
			parserOptions: {
				ecmaFeatures: { jsx: true },
			},
			globals: {
				Bun: "readonly",
				process: "readonly",
				console: "readonly",
			},
		},
		rules: {
			"no-unused-vars": "off",
			"no-undef": "off",
		},
	},
	...oxlint.buildFromOxlintConfigFile("./.oxlintrc.json"),
];
