#!/usr/bin/env bun
/**
 * Cross-platform Pure C23 LLVM (clang + lld) builder and test runner
 * for `native/c` (`rg_contract` shared library + static archive + C23 test binary).
 */

import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "../..");
const C_DIR = join(ROOT, "native/c");
const BUILD_DIR = join(C_DIR, "build");
const isWin = process.platform === "win32";

mkdirSync(BUILD_DIR, { recursive: true });

function run(cmd: string[], env?: Record<string, string | undefined>) {
  const proc = Bun.spawnSync(cmd, {
    cwd: ROOT,
    stdout: "inherit",
    stderr: "inherit",
    env: env ?? process.env,
  });
  if (proc.exitCode !== 0) {
    throw new Error(`Command failed (${proc.exitCode}): ${cmd.join(" ")}`);
  }
}

function findWindowsSdkPaths(): { includes: string[]; libs: string[] } {
  if (!isWin) return { includes: [], libs: [] };
  const includes: string[] = [];
  const libs: string[] = [];

  const vswhere = "C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe";
  if (existsSync(vswhere)) {
    const out = Bun.spawnSync([
      vswhere,
      "-latest",
      "-products",
      "*",
      "-property",
      "installationPath",
    ]).stdout
      .toString()
      .trim();
    if (out && existsSync(join(out, "VC/Tools/MSVC"))) {
      const msvcVers = readdirSync(join(out, "VC/Tools/MSVC")).sort().reverse();
      if (msvcVers[0]) {
        const msvcBase = join(out, "VC/Tools/MSVC", msvcVers[0]);
        includes.push(join(msvcBase, "include"));
        libs.push(join(msvcBase, "lib/x64"));
      }
    }
  }

  const kitsBase = "C:\\Program Files (x86)\\Windows Kits\\10";
  if (existsSync(join(kitsBase, "Include"))) {
    const kitVer = readdirSync(join(kitsBase, "Include"))
      .filter(
        (v) =>
          v.startsWith("10.") &&
          existsSync(join(kitsBase, "Include", v, "ucrt/assert.h")) &&
          existsSync(join(kitsBase, "Lib", v, "ucrt/x64/ucrt.lib")),
      )
      .sort()
      .reverse()[0];
    if (kitVer) {
      includes.push(
        join(kitsBase, "Include", kitVer, "ucrt"),
        join(kitsBase, "Include", kitVer, "shared"),
        join(kitsBase, "Include", kitVer, "um"),
      );
      libs.push(
        join(kitsBase, "Lib", kitVer, "ucrt/x64"),
        join(kitsBase, "Lib", kitVer, "um/x64"),
      );
    }
  }
  return { includes, libs };
}

const cFlags = [
  "-std=c23",
  "-O3",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-Wpedantic",
  "-I",
  join(C_DIR, "include"),
];

const sharedOut = join(
  BUILD_DIR,
  isWin ? "rg_contract.dll" : "librg_contract.so",
);
const testOut = join(
  BUILD_DIR,
  isWin ? "rg_contract_test.exe" : "rg_contract_test",
);
const srcFile = join(C_DIR, "src/rg_contract.c");
const testFile = join(C_DIR, "tests/rg_contract_test.c");
const objFile = join(BUILD_DIR, isWin ? "rg_contract.obj" : "rg_contract.o");
const staticLib = join(
  BUILD_DIR,
  isWin ? "rg_contract_static.lib" : "librg_contract.a",
);

// 1. Freestanding shared cdylib (zero libc header or runtime dependencies).
const sharedCmd = isWin
  ? [
      "clang",
      ...cFlags,
      "-ffreestanding",
      "-fuse-ld=lld",
      "-shared",
      srcFile,
      "-o",
      sharedOut,
      "-Wl,/NOENTRY",
      `-Wl,/IMPLIB:${join(BUILD_DIR, "rg_contract.lib")}`,
    ]
  : [
      "clang",
      ...cFlags,
      "-ffreestanding",
      "-nostdlib",
      "-fPIC",
      "-flto=thin",
      "-fuse-ld=lld",
      "-shared",
      srcFile,
      "-o",
      sharedOut,
    ];

run(sharedCmd);

// 2. ThinLTO bitcode static archive for cross-language LTO (`llvm-ar`).
run([
  "clang",
  ...cFlags,
  "-ffreestanding",
  "-flto=thin",
  "-c",
  srcFile,
  "-o",
  objFile,
]);
if (existsSync(staticLib)) {
  await Bun.file(staticLib).delete();
}
run(["llvm-ar", "rcs", staticLib, objFile]);

// 3. Hosted C23 test executable exercising the compiled cdylib ABI.
const winSdk = findWindowsSdkPaths();
const sdkIncludeArgs = winSdk.includes.flatMap((dir) => ["-isystem", dir]);
const sdkLibArgs = winSdk.libs.flatMap((dir) => [`-Wl,/LIBPATH:${dir}`]);

const testCmd = isWin
  ? [
      "clang",
      ...cFlags,
      ...sdkIncludeArgs,
      "-fuse-ld=lld",
      "-DRG_CONTRACT_USE_SHARED=1",
      testFile,
      join(BUILD_DIR, "rg_contract.lib"),
      ...sdkLibArgs,
      "-o",
      testOut,
    ]
  : [
      "clang",
      ...cFlags,
      "-fuse-ld=lld",
      `-Wl,-rpath,${BUILD_DIR}`,
      testFile,
      sharedOut,
      "-o",
      testOut,
    ];

run(testCmd);

if (process.argv.includes("--test")) {
  run([testOut]);
}

console.log(`Built LLVM C23 artifacts in ${BUILD_DIR}`);
