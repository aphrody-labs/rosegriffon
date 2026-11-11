import { resolve } from "node:path";

export type BunRuntimeEvidence = { version: string; revision: string; cliVersion: string };

/** Check the Bun executable against this repository's declared runtime floor. */
export async function checkBunRuntime(root: string): Promise<BunRuntimeEvidence> {
  const manifest = (await Bun.file(resolve(root, "package.json")).json()) as {
    engines?: { bun?: string };
  };
  const expected = manifest.engines?.bun?.replace(/^[=>~^]+/, "");
  const command = Bun.spawnSync([process.execPath, "--version"], { cwd: root });
  if (command.exitCode !== 0) throw new Error("Cannot inspect the current Bun executable version");
  const cliVersion = command.stdout.toString().trim();
  if (expected && !cliVersion.startsWith(expected))
    throw new Error(`Bun ${expected} required; actual CLI ${cliVersion}`);
  return { version: Bun.version, revision: Bun.revision, cliVersion };
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "../../..");
  const evidence = await checkBunRuntime(root);
  console.log(`Bun OK: ${evidence.cliVersion} revision ${evidence.revision}`);
}
