// Locate optional external disassemblers. MAME tools can live under `usr/lib/mame`; LLVM and
// Rizin are resolved through PATH. The source tree and compiled CLI both resolve the yolo-re root.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const exe = process.platform === "win32" ? ".exe" : "";

function isRoot(directory: string): boolean {
  return existsSync(join(directory, "AGENTS.md")) && existsSync(join(directory, "Cargo.toml"));
}

function walkUp(from: string): string | undefined {
  let directory = resolve(from);
  for (;;) {
    if (isRoot(directory)) return directory;
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

let cachedRoot: string | null | undefined;

/** yolo-re checkout root: RG_RE_ROOT, the source tree, then cwd and executable ancestors. */
export function workspaceRoot(): string | undefined {
  if (cachedRoot !== undefined) return cachedRoot ?? undefined;
  const fromSource = resolve(import.meta.dir, "..", "..", "..");
  const found =
    [Bun.env.RG_RE_ROOT].find(path => path && isRoot(path)) ??
    (isRoot(fromSource) ? fromSource : undefined) ??
    walkUp(process.cwd()) ??
    walkUp(dirname(process.execPath));
  cachedRoot = found ?? null;
  return found;
}

function usrDirectory(): string | undefined {
  const configured = Bun.env.YOLO_RE_USR;
  if (configured) return resolve(configured);
  const root = workspaceRoot();
  return root ? join(root, "usr") : undefined;
}

function firstFile(candidates: Array<string | undefined>): string | undefined {
  return candidates.find((path): path is string => !!path && existsSync(path));
}

/** A MAME tool (`unidasm`, `chdman`) from YOLO_RE_USR/lib/mame, or PATH. */
export function mameTool(name: "unidasm" | "chdman"): string | undefined {
  const usr = usrDirectory();
  return firstFile([usr && join(usr, "lib", "mame", `${name}${exe}`)]) ?? Bun.which(name) ?? undefined;
}

export function llvmObjdump(): string | undefined {
  return (
    Bun.which("llvm-objdump") ??
    firstFile([Bun.env.ProgramFiles ? join(Bun.env.ProgramFiles, "LLVM", "bin", "llvm-objdump.exe") : undefined])
  );
}

export function rizinAsm(): string | undefined {
  return Bun.which("rz-asm") ?? undefined;
}

export interface ToolResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs a tool with a hard timeout and captured output. */
export async function runTool(command: string[], timeoutMs = 30_000): Promise<ToolResult> {
  const child = Bun.spawn(command, {
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => child.kill(), timeoutMs);
  try {
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { code, stdout, stderr };
  } finally {
    clearTimeout(timer);
  }
}
