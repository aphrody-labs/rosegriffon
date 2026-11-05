// SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, setSystemTime, test } from "bun:test";

import { memo, PERIME_MAX_MS, viderMemo } from "./memo";

afterEach(() => {
  setSystemTime();
  viderMemo();
});

describe("memo", () => {
  test("une valeur fraîche ne relance pas le producteur", async () => {
    let appels = 0;
    const f = () => Promise.resolve(++appels);
    expect(await memo("a", 1000, f)).toBe(1);
    expect(await memo("a", 1000, f)).toBe(1);
    expect(appels).toBe(1);
  });

  test("périmée mais récente : rendue tout de suite, relue en tâche de fond", async () => {
    const t0 = Date.now();
    setSystemTime(t0);
    let appels = 0;
    let liberer = () => {};
    const lent = () =>
      new Promise<number>(resoudre => {
        appels++;
        liberer = () => resoudre(appels);
      });
    const premiere = memo("b", 1000, lent);
    liberer();
    expect(await premiere).toBe(1);

    setSystemTime(t0 + 5000);
    // Le producteur ne répond pas encore : la valeur périmée sort sans l'attendre.
    expect(await memo("b", 1000, lent)).toBe(1);
    expect(appels).toBe(2);
    liberer();
    await Promise.resolve();
    await Promise.resolve();
    expect(await memo("b", 1000, lent)).toBe(2);
  });

  test("trop ancienne : on attend la relecture, et l'échec retombe sur l'ancienne valeur", async () => {
    const t0 = Date.now();
    setSystemTime(t0);
    await memo("c", 1000, () => Promise.resolve("ancienne"));
    setSystemTime(t0 + PERIME_MAX_MS + 1);
    expect(await memo("c", 1000, () => Promise.resolve("neuve"))).toBe("neuve");
    setSystemTime(t0 + 2 * PERIME_MAX_MS + 2);
    expect(await memo<string>("c", 1000, () => Promise.reject(new Error("panne")))).toBe("neuve");
  });

  test("appels simultanés : un seul producteur", async () => {
    let appels = 0;
    const f = () => new Promise<number>(r => setTimeout(() => r(++appels), 5));
    const [x, y] = await Promise.all([memo("d", 1000, f), memo("d", 1000, f)]);
    expect([x, y, appels]).toEqual([1, 1, 1]);
  });
});
