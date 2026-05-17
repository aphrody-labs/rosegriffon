// Base ESLint flat config — héritée par les apps Next (qui rajoutent eslint-config-next).
// Les packages back-end / bot utilisent juste oxlint (plus rapide).
import js from "@eslint/js";
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
			"**/public/**",
		],
	},
	{
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
	...oxlint.buildFromOxlintConfigFile("./.oxlintrc.json"),
];
