import type { SerializedEditorState } from "lexical";

export const CATEGORIES = [
	{ value: "announcement", label: "Annonce", color: "bg-blue-500" },
	{ value: "event", label: "Événement", color: "bg-amber-500" },
	{ value: "critique", label: "Critique", color: "bg-rose-500" },
	{ value: "community", label: "Communauté", color: "bg-purple-500" },
] as const;

export const STATUS_OPTIONS = [
	{
		value: "draft",
		label: "Brouillon",
		color: "bg-amber-500",
		textColor: "text-amber-500",
	},
	{
		value: "scheduled",
		label: "Programmé",
		color: "bg-blue-500",
		textColor: "text-blue-500",
	},
	{
		value: "published",
		label: "Publié",
		color: "bg-green-500",
		textColor: "text-green-500",
	},
	{
		value: "archived",
		label: "Archivé",
		color: "bg-stone-500",
		textColor: "text-stone-500",
	},
] as const;

export const EMPTY_CONTENT: SerializedEditorState = {
	root: {
		children: [
			{
				children: [],
				direction: null,
				format: "",
				indent: 0,
				type: "paragraph",
				version: 1,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
			} as any,
		],
		direction: null,
		format: "",
		indent: 0,
		type: "root",
		version: 1,
	},
};

export const CROP_RATIO_PRESETS = [
	{ label: "21:9", value: 21 / 9 },
	{ label: "16:9", value: 16 / 9 },
	{ label: "4:3", value: 4 / 3 },
	{ label: "Libre", value: undefined },
] as const;
