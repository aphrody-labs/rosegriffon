// SPDX-License-Identifier: Apache-2.0

/** Command that re-runs this program: the compiled executable, or Bun on the source entry. */
export function selfCommand(...args: string[]): string[] {
  const compiled = import.meta.path.startsWith("/$bunfs/") || /^[A-Z]:\\~BUN\\/i.test(import.meta.path);
  return compiled ? [process.execPath, ...args] : [process.execPath, Bun.main, ...args];
}

/** Restarts a child with exponential backoff (1 s to 60 s, reset after 60 s alive). */
export function supervise(name: string, cmd: string[], env: Record<string, string | undefined> = {}): () => void {
  let child: ReturnType<typeof Bun.spawn> | null = null;
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const start = () => {
    if (stopped) return;
    const startedAt = Date.now();
    child = Bun.spawn({
      cmd,
      env: { ...process.env, ...env },
      stdin: "ignore",
      stdout: "inherit",
      stderr: "inherit",
      onExit(_proc, code, signal) {
        child = null;
        if (stopped) return;
        failures = Date.now() - startedAt > 60_000 ? 0 : failures + 1;
        const delay = Math.min(60_000, 1000 * 2 ** Math.min(failures, 6));
        console.error(`[rosegriffon] ${name} exited (code ${code ?? "?"}, signal ${signal ?? "-"}), restarting in ${delay} ms`);
        timer = setTimeout(start, delay);
      },
    });
    console.info(`[rosegriffon] ${name} started (pid ${child.pid})`);
  };
  start();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    child?.kill("SIGTERM");
  };
}
