import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("Unified CLI reports help and version", async () => {
  const cliEntry = resolve(import.meta.dir, "index.ts");

  // Test --version
  const procVer = Bun.spawn([process.execPath, cliEntry, "--version"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdoutVer, stderrVer, codeVer] = await Promise.all([
    new Response(procVer.stdout).text(),
    new Response(procVer.stderr).text(),
    procVer.exited,
  ]);
  expect(codeVer).toBe(0);
  expect(stdoutVer).toContain("@rosegriffon/cli v1.4.8");

  // Test --help
  const procHelp = Bun.spawn([process.execPath, cliEntry, "--help"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdoutHelp, stderrHelp, codeHelp] = await Promise.all([
    new Response(procHelp.stdout).text(),
    new Response(procHelp.stderr).text(),
    procHelp.exited,
  ]);
  expect(codeHelp).toBe(0);
  expect(stdoutHelp).toContain("Rose Griffon Unified CLI");
  expect(stdoutHelp).toContain("inagle");
  expect(stdoutHelp).toContain("azalee");
  expect(stdoutHelp).toContain("formats");
  expect(stdoutHelp).toContain("homebrew");
  expect(stdoutHelp).toContain("pipeline");
  expect(stdoutHelp).toContain("contract");
});
