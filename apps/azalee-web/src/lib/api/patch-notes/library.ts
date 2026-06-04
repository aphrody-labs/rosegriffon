import fs from "node:fs";
import path from "node:path";
import type { PatchNoteSummary } from "../types";

// Get the directory of this file
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

// Data path relative to the API root
// Using EN for now as verified source, but structure allows adding FR later
const DATA_PATH = process.env.DATA_PATH
	? path.join(process.env.DATA_PATH, "inazuma.jp/victory-road/en/patchnote")
	: path.resolve(__dirname, "../../../../data/inazuma.jp/victory-road/en/patchnote");

export interface LocalPatchNoteDetail extends PatchNoteSummary {
	content_html: string;
	featured_image: string | null;
}

export class PatchNotesLibrary {
	private notes: PatchNoteSummary[] = [];
	private initialized = false;

	constructor() {
		this.loadData();
	}

	private loadData() {
		if (this.initialized) {
			return;
		}

		// We need to scan all platform folders: ps-steam, switch, xbox
		const platforms = ["ps-steam", "switch", "xbox"];

		platforms.forEach((platform) => {
			const platformPath = path.join(DATA_PATH, platform);
			if (!fs.existsSync(platformPath)) {
				return;
			}

			// Look for an index.json if we generated one, OR verify folders
			// For topics we parsed index.html. Here, we might not have a main index.html for the list if we scrape individual pages.
			// BUT, the scraper `scrapePatchNoteList` returns a list. We should probably save that list as `index.json` or `index.html` in the platform folder.
			// Let's assume we will save `index.json` in each platform folder for the list.

			const listPath = path.join(platformPath, "index.json");
			if (fs.existsSync(listPath)) {
				try {
					const platformNotes = JSON.parse(fs.readFileSync(listPath, "utf8")) as PatchNoteSummary[];
					// Add them to our main list, avoiding duplicates if any
					platformNotes.forEach((note) => {
						// Create unique entry per platform group to preserve specific titles/content
						const uniqueId = `${platform}_${note.id}`;

						// Check if already added (should not happen with prefix logic but good safety)
						if (!this.notes.find((n) => n.id === uniqueId)) {
							this.notes.push({
								...note,
								id: uniqueId,
							});
						}
					});
				} catch (error) {
					console.error(`[PatchNotesLib] Failed to parse index.json for ${platform}`, error);
				}
			}
		});

		// Sort by date descending (assuming formatted YYYY.MM.DD)
		this.notes.sort((a, b) => b.date.localeCompare(a.date));
		this.initialized = true;
		console.log(`[PatchNotesLib] Loaded ${this.notes.length} patch notes from local cache`);
	}

	public getAll(platform?: string): PatchNoteSummary[] {
		if (this.initialized === false) {
			this.loadData();
		}

		if (!platform) {
			return this.notes;
		}
		// Filter: check if the note's platform array includes the requested platform
		// The API request might ask for "ps-steam", "switch", etc.
		// Our scraper stores platform as ["ps4", "ps5", "steam"] for "ps-steam".

		let targetPlatforms: string[] = [platform];
		if (platform === "ps-steam") {
			targetPlatforms = ["ps4", "ps5", "steam"];
		}

		return this.notes.filter((n) => n.platform.some((p) => targetPlatforms.includes(p)));
	}

	public getById(
		compositeId: string,
		_platformIgnored: string = "ps-steam"
	): LocalPatchNoteDetail | null {
		if (this.initialized === false) {
			this.loadData();
		}

		const summary = this.notes.find((n) => n.id === compositeId);

		let platform: string;
		let realId: string;

		if (compositeId.startsWith("ps-steam_")) {
			platform = "ps-steam";
			realId = compositeId.replace("ps-steam_", "");
		} else if (compositeId.startsWith("switch_")) {
			platform = "switch";
			realId = compositeId.replace("switch_", "");
		} else if (compositeId.startsWith("xbox_")) {
			platform = "xbox";
			realId = compositeId.replace("xbox_", "");
		} else {
			return null;
		}

		const detailPath = path.join(DATA_PATH, platform, realId, "index.html");
		if (!fs.existsSync(detailPath)) {
			console.warn(`[PatchNotesLib] Detail file not found: ${detailPath}`);
			return null;
		}

		const html = fs.readFileSync(detailPath, "utf8");

		const jsonPath = path.join(DATA_PATH, platform, realId, "data.json");
		let featured_image = summary?.featured_image || null;

		if (fs.existsSync(jsonPath)) {
			try {
				const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
				if (data.featured_image) ({ featured_image } = data);
			} catch {
				// Ignore JSON parsing errors and fallback to summary.featured_image
			}
		}

		return {
			...(summary || { date: "", id: compositeId, platform: [], title: "Unknown", url: "" }),
			content_html: html,
			featured_image,
		};
	}

	public refresh() {
		this.notes = [];
		this.initialized = false;
		this.loadData();
	}
}

export const patchNotesLib = new PatchNotesLibrary();
