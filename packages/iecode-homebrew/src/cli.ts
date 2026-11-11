#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const manifestPath = new URL("../../../crates/aphrody-homebrew/Cargo.toml", import.meta.url);
const manifestFile = fileURLToPath(manifestPath);
const args = Bun.argv.slice(2);

if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
  console.log("Usage: bun run iecode-homebrew <targets|doctor|build nds|build 3ds>");
  process.exit(0);
}

const configuredBinary = process.env.IECODE_HOMEBREW_BINARY?.trim();
const binary = configuredBinary
  ? Bun.which(configuredBinary) ?? (existsSync(configuredBinary) ? configuredBinary : undefined)
  : Bun.which("aphrody-homebrew");
if (configuredBinary && !binary) {
  console.error(
    `IECODE_HOMEBREW_BINARY points to an unavailable executable: ${configuredBinary}. Set it to a valid file or executable on PATH.`,
  );
  process.exit(1);
}
if (!binary && !existsSync(manifestFile)) {
  console.error(
    `Homebrew backend unavailable: expected the aphrody-homebrew crate at ${manifestFile}, or set IECODE_HOMEBREW_BINARY to an installed executable.`,
  );
  process.exit(1);
}
try {
  const proc = Bun.spawn(
    binary
      ? [binary, ...args]
      : ["cargo", "run", "--quiet", "--manifest-path", manifestFile, "--", ...args],
    { cwd: repoRoot, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
  );
  process.exit(await proc.exited);
} catch (error) {
  console.error(`Could not start the Homebrew backend: ${String(error)}`);
  process.exit(1);
}
