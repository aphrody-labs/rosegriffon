import { describe, expect, test } from "bun:test";
import { LVP_ICD_PATH } from "./host.ts";
import { vulkanEnv } from "./vulkan.ts";

describe("vulkanEnv", () => {
	test("utilise VK_DRIVER_FILES (pas l'obsolète VK_ICD_FILENAMES) + select = nom manifest", () => {
		const env = vulkanEnv({ renderThreads: 6 });
		expect(env["VK_DRIVER_FILES"]).toBe(LVP_ICD_PATH);
		// CORRECTION : le select matche le NOM DE MANIFEST, pas "lvp" (qui est rejeté).
		expect(env["VK_LOADER_DRIVERS_SELECT"]).toBe("lvp_icd.json");
		// L'env déprécié ne doit PAS être posé.
		expect(env["VK_ICD_FILENAMES"]).toBeUndefined();
	});

	test("LP_NUM_THREADS = cœurs render", () => {
		expect(vulkanEnv({ renderThreads: 6 })["LP_NUM_THREADS"]).toBe("6");
		expect(vulkanEnv({ renderThreads: 1 })["LP_NUM_THREADS"]).toBe("1");
	});

	test("LP_NUM_THREADS plancher à 1 si 0/négatif", () => {
		expect(vulkanEnv({ renderThreads: 0 })["LP_NUM_THREADS"]).toBe("1");
	});

	test("fallback GL logiciel activable", () => {
		const on = vulkanEnv({ renderThreads: 4, softwareGl: true });
		expect(on["LIBGL_ALWAYS_SOFTWARE"]).toBe("1");
		expect(on["GALLIUM_DRIVER"]).toBe("llvmpipe");
		const off = vulkanEnv({ renderThreads: 4, softwareGl: false });
		expect(off["LIBGL_ALWAYS_SOFTWARE"]).toBeUndefined();
	});

	test("icdPath surchargé est honoré", () => {
		expect(vulkanEnv({ renderThreads: 2, icdPath: "/x/lvp.json" })["VK_DRIVER_FILES"]).toBe(
			"/x/lvp.json",
		);
	});
});
