import { describe, expect, test } from "bun:test";
import { AssetPump, backingSize, wasmUrls } from "./nie-client-host";

describe("backingSize", () => {
  test("applies devicePixelRatio below the cap", () => {
    expect(backingSize(800, 450, 2)).toEqual({ w: 1600, h: 900 });
  });
  test("caps the backing store at 1920x1080 pixels and keeps the aspect", () => {
    const { w, h } = backingSize(2560, 1440, 2);
    expect(w * h).toBeLessThanOrEqual(1920 * 1080);
    expect(Math.abs(w / h - 16 / 9)).toBeLessThan(0.01);
  });
});

describe("wasmUrls", () => {
  test("points at the content-addressed CDN directory", () => {
    const u = wasmUrls("https://cdn.example");
    expect(u.js).toMatch(
      /^https:\/\/cdn\.example\/static\/nie\/wasm\/[0-9a-f]{16}\/aphrody_nie_wasm\.js$/,
    );
    expect(u.wasm.endsWith("/aphrody_nie_wasm_bg.wasm")).toBe(true);
  });
});

describe("AssetPump", () => {
  test("never exceeds the concurrency cap and answers each request once", async () => {
    let active = 0;
    let peak = 0;
    const fetcher = (async (url: string) => {
      active++;
      peak = Math.max(peak, active);
      await Bun.sleep(5);
      active--;
      if (url.endsWith("/404"))
        return new Response("no", { status: 404, statusText: "Not Found" });
      if (url.endsWith("/net")) throw new TypeError("network");
      return new Response(new Uint8Array([1, 2, 3]));
    }) as unknown as typeof fetch;
    const provided: number[] = [];
    const failed: [number, number][] = [];
    const pump = new AssetPump(
      {
        provide_asset: (id) => provided.push(id),
        asset_failed: (id, status) => failed.push([id, status]),
      },
      6,
      fetcher,
    );
    const reqs = Array.from({ length: 20 }, (_, id) => ({
      id,
      url: id === 3 ? "/404" : id === 4 ? "/net" : `/ok/${id}`,
    }));
    pump.push(reqs);
    while (provided.length + failed.length < 20) await Bun.sleep(5);
    expect(peak).toBe(6);
    expect(failed.sort()).toEqual([
      [3, 404],
      [4, 0],
    ]);
    expect(provided.length).toBe(18);
  });

  test("turns a provide_asset throw into asset_failed", async () => {
    const failed: number[] = [];
    const pump = new AssetPump(
      {
        provide_asset: () => {
          throw new Error("undecodable");
        },
        asset_failed: (id) => failed.push(id),
      },
      6,
      (async () => new Response("x")) as unknown as typeof fetch,
    );
    pump.push([{ id: 7, url: "/x" }]);
    while (failed.length === 0) await Bun.sleep(1);
    expect(failed).toEqual([7]);
  });
});
