// Minimal CDP helper over Chrome headless (no deps).
export async function launch(port = 9333) {
  const proc = Bun.spawn(
    [
      process.env.CHROME ??
        "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${process.env.TEMP ?? "/tmp"}/achillea-parity-chrome-${port}`,
      "--force-device-scale-factor=1",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdout: "ignore", stderr: "ignore" },
  );
  let tabs: any[] = [];
  for (let i = 0; i < 50; i++) {
    try {
      tabs = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      if (tabs.length) break;
    } catch {}
    await Bun.sleep(200);
  }
  const page = tabs.find((t) => t.type === "page");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0;
  const pending = new Map<number, (v: any) => void>();
  const listeners: ((m: any) => void)[] = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(String(e.data));
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)!(m);
      pending.delete(m.id);
    } else listeners.forEach((l) => l(m));
  });
  const send = (method: string, params: any = {}) =>
    new Promise<any>((r) => {
      const i = ++id;
      pending.set(i, r);
      ws.send(JSON.stringify({ id: i, method, params }));
    }).then((m) => {
      if (m.error) throw new Error(method + ": " + m.error.message);
      return m.result;
    });
  const evaluate = async (expr: string) =>
    (
      await send("Runtime.evaluate", {
        expression: expr,
        awaitPromise: true,
        returnByValue: true,
      })
    ).result?.value;
  return {
    proc,
    send,
    evaluate,
    on: (f: (m: any) => void) => listeners.push(f),
    close: () => {
      ws.close();
      proc.kill();
    },
  };
}
