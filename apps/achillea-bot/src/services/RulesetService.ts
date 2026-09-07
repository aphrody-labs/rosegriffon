import { singleton } from "tsyringe";

import { Ruleset } from "@/entities";
import { RulesetCategory } from "@/utils/enums";

import { Database } from "./Database";

export interface CloneOpts {
	name: string;
	version: string;
	category?: RulesetCategory;
}

export interface ValidationResult {
	ok: boolean;
	errors: string[];
}

// Semver regex (loose: major.minor.patch, all numeric)
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

@singleton()
export class RulesetService {
	constructor(private db: Database) {}

	// Queries

	async findById(id: string): Promise<Ruleset> {
		const em = this.db.em.fork();
		const ruleset = await em.findOne(Ruleset, { id });
		if (!ruleset) {
			throw new Error(`Ruleset not found: ${id}`);
		}
		return ruleset;
	}

	/**
	 * Returns all official rulesets (isOfficial = true).
	 * Includes the 3 seeded rulesets: Astral League, Astral Cup, TBC.
	 */
	async listOfficial(): Promise<Ruleset[]> {
		const em = this.db.em.fork();
		return em.find(Ruleset, { isOfficial: true }, { orderBy: { name: "ASC" } });
	}

	// Mutations

	/**
	 * Clones an existing ruleset into a new one.
	 * All jsonb fields + scalar config are copied verbatim.
	 * parentRuleset is set to the source ruleset.
	 * The source ruleset is NOT modified.
	 */
	async clone(parentId: string, opts: CloneOpts): Promise<Ruleset> {
		const em = this.db.em.fork();

		const parent = await em.findOne(Ruleset, { id: parentId });
		if (!parent) {
			throw new Error(`Parent ruleset not found: ${parentId}`);
		}

		const now = new Date();
		const cloned = em.create(Ruleset, {
			createdAt: now,
			updatedAt: now,
			version: opts.version,
			name: opts.name,
			category: opts.category ?? RulesetCategory.Custom,
			isOfficial: false,
			forbiddenTacticsDropable: parent.forbiddenTacticsDropable
				? [...parent.forbiddenTacticsDropable]
				: null,
			forbiddenTacticsMovement: parent.forbiddenTacticsMovement
				? [...parent.forbiddenTacticsMovement]
				: null,
			forbiddenTacticsImmobilization: parent.forbiddenTacticsImmobilization
				? [...parent.forbiddenTacticsImmobilization]
				: null,
			forbiddenTacticsRng: parent.forbiddenTacticsRng ? [...parent.forbiddenTacticsRng] : null,
			stadiumsAllowed: parent.stadiumsAllowed ? [...parent.stadiumsAllowed] : null,
			defaultBo: parent.defaultBo,
			goldenGoal: parent.goldenGoal,
			halfTimeMinutes: parent.halfTimeMinutes,
			judgmentOfAdvantageProtocol: parent.judgmentOfAdvantageProtocol
				? { ...parent.judgmentOfAdvantageProtocol }
				: null,
			tiebreakerRules: parent.tiebreakerRules ? { ...parent.tiebreakerRules } : null,
			parentRuleset: parent,
		});

		await em.persist(cloned).flush();
		return cloned;
	}

	// Validation

	/**
	 * Validates a Ruleset object (or partial shape) synchronously.
	 * Returns { ok: true } when all rules pass, { ok: false, errors: [...] } otherwise.
	 *
	 * Rules:
	 *   - name must be non-empty
	 *   - version must match semver (X.Y.Z) or equal "legacy"
	 *   - defaultBo must be a positive odd integer (best-of-N must be odd)
	 */
	validate(ruleset: { name: string; version: string; defaultBo: number }): ValidationResult {
		const errors: string[] = [];

		// Rule 1 — name non-empty
		if (!ruleset.name || ruleset.name.trim().length === 0) {
			errors.push("name must not be empty");
		}

		// Rule 2 — version is semver or "legacy"
		if (ruleset.version !== "legacy" && !SEMVER_RE.test(ruleset.version)) {
			errors.push(`version "${ruleset.version}" is not a valid semver (X.Y.Z) or "legacy"`);
		}

		// Rule 3 — defaultBo > 0
		if (!Number.isInteger(ruleset.defaultBo) || ruleset.defaultBo <= 0) {
			errors.push("defaultBo must be a positive integer");
		}

		// Rule 4 — defaultBo must be odd (best-of-N: 1, 3, 5…)
		if (Number.isInteger(ruleset.defaultBo) && ruleset.defaultBo % 2 === 0) {
			errors.push("defaultBo must be an odd number (best-of-N: 1, 3, 5…)");
		}

		return { ok: errors.length === 0, errors };
	}
}
