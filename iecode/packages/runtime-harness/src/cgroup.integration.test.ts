/**
 * Tests d'intégration cgroup (sûrs : lancent `sleep`, JAMAIS le jeu).
 * Skippés si systemd-run / cgroup v2 absent (ex. CI sans systemd utilisateur).
 */
import { existsSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { spawnConfined } from "./cgroup.ts";
import { detectHost } from "./host.ts";

const host = await detectHost();
const canRun = host.cgroupV2 && host.hasSystemdRun;

describe.if(canRun)("spawnConfined + cgroup.kill (intégration, avec sleep)", () => {
	test("place le process dans un cgroup délégué et le tue atomiquement", async () => {
		const { proc, cgroup } = await spawnConfined(["sleep", "120"], {
			unitPrefix: "iecode-test",
			stdout: "ignore",
			stderr: "ignore",
		});

		try {
			expect(cgroup.path).not.toBe("");
			expect(existsSync(`${cgroup.path}/cgroup.kill`)).toBe(true);

			// Le sleep doit apparaître dans le cgroup.
			let procs: number[] = [];
			for (let i = 0; i < 40 && procs.length === 0; i++) {
				procs = await cgroup.procs();
				if (procs.length === 0) await Bun.sleep(25);
			}
			expect(procs.length).toBeGreaterThan(0);

			// Kill atomique : le sous-arbre disparaît.
			await cgroup.killAll();
			await Bun.sleep(200);
			expect(await cgroup.procs()).toEqual([]);
			expect(proc.killed).toBe(true);
		} finally {
			await cgroup.killAll(); // idempotent
		}
	}, 15_000);

	test("killAll est idempotent (rejouable sans erreur)", async () => {
		const { cgroup } = await spawnConfined(["sleep", "30"], {
			unitPrefix: "iecode-test",
			stdout: "ignore",
			stderr: "ignore",
		});
		await cgroup.killAll();
		await cgroup.killAll();
		await cgroup.killAll();
		expect(await cgroup.procs()).toEqual([]);
	}, 15_000);
});
