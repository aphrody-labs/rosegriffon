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
