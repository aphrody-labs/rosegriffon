import { writeFileSync } from "node:fs";
import { renderEventList, renderProfileCard, renderTeamGrid } from "../lib/canvas/cards";
import { getProfile, getTeam, nextEvents } from "../services/website";

async function main() {
	console.log("[smoke] team grid (staff)");
	const team = await getTeam("staff");
	const teamPng = await renderTeamGrid(team, "Staff Rose Griffon");
	writeFileSync("/tmp/rg-staff.png", teamPng);
	console.log(`  → /tmp/rg-staff.png (${teamPng.length} bytes, ${team.length} members)`);

	console.log("[smoke] profile card (koltilasko)");
	const profile = await getProfile("koltilasko");
	if (profile) {
		const profPng = await renderProfileCard(profile);
		writeFileSync("/tmp/rg-profil.png", profPng);
		console.log(`  → /tmp/rg-profil.png (${profPng.length} bytes)`);
	} else {
		console.log("  ⚠ profile not found");
	}

	console.log("[smoke] event list (next 5)");
	const events = await nextEvents(5);
	if (events.length > 0) {
		const evPng = await renderEventList(events);
		writeFileSync("/tmp/rg-events.png", evPng);
		console.log(`  → /tmp/rg-events.png (${evPng.length} bytes, ${events.length} events)`);
	} else {
		console.log("  ⚠ no upcoming events");
	}
	process.exit(0);
}

main().catch((err) => {
	console.error("✗ smoke failed:", err);
	process.exit(1);
});
