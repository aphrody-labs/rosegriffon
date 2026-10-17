import { resolve } from "node:path";

export type BunRuntimeEvidence = { version: string; revision: string; cliVersion: string };

/** The workspace runs on a Bun satisfying the root `engines.bun` range. */
export async function checkBunRuntime(root: string): Promise<BunRuntimeEvidence> {
  const manifest = (await Bun.file(resolve(root, "package.json")).json()) as {
    engines?: { bun?: string };
  };
  const range = manifest.engines?.bun;
  const command = Bun.spawnSync([process.execPath, "--version"], { cwd: root });
  if (command.exitCode !== 0) throw new Error("Cannot inspect the current Bun executable version");
  const cliVersion = command.stdout.toString().trim();
  if (range && !Bun.semver.satisfies(cliVersion.replace(/[-+].*$/, ""), range)) {
    throw new Error(`Bun ${range} required; actual CLI ${cliVersion}`);
  }
  return { version: Bun.version, revision: Bun.revision, cliVersion };
}

if (import.meta.main) {
  const evidence = await checkBunRuntime(resolve(import.meta.dir, ".."));
  console.log(`Bun OK: ${evidence.cliVersion} revision ${evidence.revision}`);
}
