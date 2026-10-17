/**
 * Garde le prédicat d'autorisation TO côté web (UI Modifier / Scores / Participants).
 * Run : bun test tests/tournament-organizer.test.ts
 */
import { describe, expect, test } from "bun:test";
import { isTournamentOrganizerUser } from "../src/app/core/helpers/tournament-organizer";

const tournament = {
	organization: {
		owner: { id: "owner-1" },
		managers: [
			// Forme API réelle : pas d'id composite au top-level, seulement user
			{ user: { id: "org-mgr-1" } },
			{ user: { id: "org-mgr-2" } },
		],
	},
	managers: [{ id: "to-1" }, { id: "to-2" }],
};

describe("isTournamentOrganizerUser", () => {
	test("refuse un visiteur anonyme (user null / undefined / sans id)", () => {
		expect(isTournamentOrganizerUser(null, tournament)).toBe(false);
		expect(isTournamentOrganizerUser(undefined, tournament)).toBe(false);
		expect(isTournamentOrganizerUser({}, tournament)).toBe(false);
		expect(isTournamentOrganizerUser({ id: null }, tournament)).toBe(false);
		expect(isTournamentOrganizerUser({ role: 3 }, tournament)).toBe(false);
	});

	test("ne confond pas undefined === undefined sur les managers d'org (bug prod)", () => {
		// Les managers d'org n'ont pas d'id top-level en JSON API.
		// L'ancienne impl `(om as any).id === user?.id` était vraie pour tout anonyme.
		const t = {
			organization: {
				owner: { id: "owner-1" },
				managers: [{ user: { id: "org-mgr-1" }, id: undefined as string | undefined }],
			},
			managers: [],
		};
		expect(isTournamentOrganizerUser(undefined, t)).toBe(false);
		expect(isTournamentOrganizerUser({ id: "stranger" }, t)).toBe(false);
	});

	test("accepte owner, manager org, TO et SuperAdmin", () => {
		expect(isTournamentOrganizerUser({ id: "owner-1" }, tournament)).toBe(true);
		expect(isTournamentOrganizerUser({ id: "org-mgr-2" }, tournament)).toBe(true);
		expect(isTournamentOrganizerUser({ id: "to-1" }, tournament)).toBe(true);
		expect(isTournamentOrganizerUser({ id: "anyone", role: 3 }, tournament)).toBe(true);
	});

	test("refuse un simple participant / intrus", () => {
		expect(isTournamentOrganizerUser({ id: "intrus", role: 0 }, tournament)).toBe(false);
		expect(isTournamentOrganizerUser({ id: "intrus", role: 1 }, tournament)).toBe(false);
	});

	test("gère tournoi ou org absents sans throw", () => {
		expect(isTournamentOrganizerUser({ id: "x" }, null)).toBe(false);
		expect(isTournamentOrganizerUser({ id: "x" }, {})).toBe(false);
		expect(isTournamentOrganizerUser({ id: "x" }, { organization: null })).toBe(false);
	});
});
