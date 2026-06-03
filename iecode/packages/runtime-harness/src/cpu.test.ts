import { describe, expect, test } from "bun:test";
import { planCpu, tasksetPrefix } from "./cpu.ts";

describe("planCpu", () => {
	test("12 cœurs → split 6/4/2 (render/game/io) avec render en queue", () => {
		const p = planCpu(12);
		expect(p.totalCores).toBe(12);
		expect(p.gameCpus).toBe("0-3");
		expect(p.ioCpus).toBe("4-5");
		expect(p.renderCpus).toBe("6-11");
		expect(p.renderThreads).toBe(6);
		// LP_NUM_THREADS doit == cœurs render ; GC affinity == plage render.
		expect(p.gcHeapCount).toBe(6);
		expect(p.gcHeapAffinitizeRanges).toBe("6-11");
	});

	test("partition couvre [0..n-1] sans chevauchement pour 12 cœurs", () => {
		const p = planCpu(12);
		// game 0-3, io 4-5, render 6-11 : contigu, complet, disjoint.
		expect(p.gameCpus).toBe("0-3");
		expect(p.ioCpus).toBe("4-5");
		expect(p.renderCpus).toBe("6-11");
	});

	test("8 cœurs → proportionnel, plages valides disjointes", () => {
		const p = planCpu(8);
		expect(p.renderThreads).toBeGreaterThanOrEqual(1);
		expect(p.totalCores).toBe(8);
		// render moitié = 4, game tiers = 2, io = reste = 2
		expect(p.renderCpus).toBe("4-7");
		expect(p.gameCpus).toBe("0-1");
		expect(p.ioCpus).toBe("2-3");
	});

	test("2 cœurs → pas de sur-segmentation, tout partagé", () => {
		const p = planCpu(2);
		expect(p.renderCpus).toBe("0-1");
		expect(p.gameCpus).toBe("0-1");
		expect(p.ioCpus).toBe("0-1");
		expect(p.renderThreads).toBe(2);
	});

	test("1 cœur → '0' partout, jamais de plage vide", () => {
		const p = planCpu(1);
		expect(p.renderCpus).toBe("0");
		expect(p.renderThreads).toBe(1);
	});
});

describe("tasksetPrefix", () => {
	test("préfixe sans '--' (taskset n'accepte pas le séparateur)", () => {
		expect(tasksetPrefix("0-3", true)).toEqual(["taskset", "-c", "0-3"]);
	});
	test("vide quand taskset absent (OS schedule librement)", () => {
		expect(tasksetPrefix("0-3", false)).toEqual([]);
	});
});
