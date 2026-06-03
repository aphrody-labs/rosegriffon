import { expect, test } from "bun:test";
import { IECODE_CORE_DLL, loadIecode } from "./index.ts";

test("IECODE_CORE_DLL pointe vers l'assembly Release net10.0", () => {
	expect(IECODE_CORE_DLL).toContain("IECODE.Core");
	expect(IECODE_CORE_DLL).toEndWith("bin/Release/net10.0/IECODE.Core.dll");
});

test("node-api-dotnet projette tout IECODE.Core vers Bun", () => {
	const dotnet = loadIecode();
	// L'espace de noms .NET complet est projeté : IECODE.Core.* accessible.
	expect(dotnet.IECODE.Core).toBeDefined();
});
