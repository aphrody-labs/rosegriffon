import { describe, expect, test } from "bun:test";

import {
	readManifest,
	validateManifest,
	validateRepository,
	type AchilleaServiceManifest,
} from "./check-services-config";

function clone(manifest: AchilleaServiceManifest): AchilleaServiceManifest {
	return structuredClone(manifest);
}

describe("Achillea service manifest", () => {
	test("matches the repository configuration", async () => {
		const manifest = await readManifest();
		expect(validateManifest(manifest)).toEqual([]);
		expect(await validateRepository(manifest)).toEqual([]);
	});

	test("rejects a public server credential", async () => {
		const manifest = clone(await readManifest());
		manifest.environment.publicBrowserConfiguration.push("SUPABASE_SERVICE_KEY");
		expect(validateManifest(manifest)).toContain(
			"SUPABASE_SERVICE_KEY must not be exposed to the browser"
		);
	});

	test("rejects drift from the production workspace", async () => {
		const manifest = clone(await readManifest());
		manifest.ownership.workspace = "/tmp/rg";
		expect(validateManifest(manifest)).toContain("workspace must be /home/ubuntu/rg");
	});

	test("rejects a secrets file in the repository", async () => {
		const manifest = clone(await readManifest());
		manifest.ownership.productionSecretsFile = "/home/ubuntu/rg/.env";
		expect(validateManifest(manifest)).toContain(
			"production secrets file must stay outside the repository"
		);
		manifest.ownership.productionSecretsFile = "/etc/../home/ubuntu/rg/.env";
		expect(validateManifest(manifest)).toContain(
			"production secrets file must stay outside the repository"
		);
	});

	test("rejects a local Supabase secrets file in the production workspace", async () => {
		const manifest = clone(await readManifest());
		manifest.localSupabaseTarget.secretsFiles.push("/home/ubuntu/rg/config/storage.env");
		expect(validateManifest(manifest)).toContain(
			"local Supabase secret file must stay outside the repository: /home/ubuntu/rg/config/storage.env"
		);
	});

	test("rejects port drift", async () => {
		const manifest = clone(await readManifest());
		const ranked = manifest.services.find(({ id }) => id === "ranked");
		if (!ranked) throw new Error("ranked fixture missing");
		ranked.port = 4999;
		expect(validateManifest(manifest)).toContain("ranked must use port 4002");
	});

	test("rejects operational commands", async () => {
		const manifest = clone(await readManifest());
		const backend = manifest.services.find(({ id }) => id === "backend");
		if (!backend) throw new Error("backend fixture missing");
		backend.productionCommand = ["bun", "run", "deploy"];
		expect(validateManifest(manifest)).toContain(
			"backend command contains an operational side effect"
		);
	});
});
