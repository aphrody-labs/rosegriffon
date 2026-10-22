/**
 * Copyright 2026 Rose Griffon
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from "bun:test";
import type { SQL } from "bun";
import { clientParesseux, estPoolEmpoisonne, signalerErreurSql } from "./db";

/** Faux client Bun.SQL : tag appelable, `begin()` et `close()` tracés. */
function fauxSql(id: number, fermetures: Array<{ id: number; timeout?: number }>): SQL {
  const tag = (strings: TemplateStringsArray, ...valeurs: unknown[]) => ({ id, texte: strings.join("?"), valeurs });
  return Object.assign(tag, {
    id,
    begin(this: { id: number }, fn: (tx: unknown) => unknown) {
      return fn(this.id);
    },
    close(options?: { timeout?: number }) {
      fermetures.push({ id, timeout: options?.timeout });
      return Promise.resolve();
    },
  }) as unknown as SQL;
}

describe("estPoolEmpoisonne", () => {
  test("reconnaît l'erreur native du pool, en Error comme en message agrégé", () => {
    expect(estPoolEmpoisonne(new Error("connection must be a PostgresSQLConnection"))).toBe(true);
    // Forme du résumé de `discord:sync`, repris tel quel par le runner.
    expect(
      estPoolEmpoisonne("Rose Griffon : 2 membre(s) en échec | liens OAuth : connection must be a PostgresSQLConnection"),
    ).toBe(true);
  });

  test("ignore les erreurs de base ordinaires", () => {
    expect(estPoolEmpoisonne(new Error('relation "discord_polls" does not exist'))).toBe(false);
    expect(estPoolEmpoisonne(new Error("Connection closed"))).toBe(false);
    expect(estPoolEmpoisonne(undefined)).toBe(false);
    expect(estPoolEmpoisonne({ message: "connection must be a PostgresSQLConnection" })).toBe(false);
  });
});

describe("clientParesseux", () => {
  test("crée le pool au premier usage seulement, et lie ses méthodes à la vraie instance", async () => {
    const fermetures: Array<{ id: number; timeout?: number }> = [];
    let crees = 0;
    const client = clientParesseux(() => fauxSql(++crees, fermetures));
    expect(crees).toBe(0);

    const requete = client.sql`SELECT ${1}` as unknown as { id: number; valeurs: unknown[] };
    expect(requete.id).toBe(1);
    expect(requete.valeurs).toEqual([1]);
    expect((await client.sql.begin(async tx => tx)) as unknown).toBe(1);
    expect(crees).toBe(1);
  });

  test("recreer() détache le pool courant, le ferme avec délai, et le suivant est neuf", async () => {
    const fermetures: Array<{ id: number; timeout?: number }> = [];
    let crees = 0;
    const client = clientParesseux(() => fauxSql(++crees, fermetures));

    expect(client.recreer()).toBe(false); // rien d'ouvert : rien à fermer
    expect(crees).toBe(0);

    expect((await client.sql.begin(async tx => tx)) as unknown).toBe(1);
    expect(client.recreer()).toBe(true);
    expect(fermetures).toEqual([{ id: 1, timeout: 30 }]);

    expect((await client.sql.begin(async tx => tx)) as unknown).toBe(2);
    expect((client.sql`SELECT 1` as unknown as { id: number }).id).toBe(2);
    expect(crees).toBe(2);
  });

  test("une fermeture qui lève ou rejette ne fait pas échouer la recréation", () => {
    let crees = 0;
    const client = clientParesseux(() => {
      crees++;
      return Object.assign(() => undefined, {
        close: crees === 1 ? () => Promise.reject(new Error("pool mort")) : () => {
          throw new Error("pool mort");
        },
      }) as unknown as SQL;
    });
    void client.sql.close;
    expect(client.recreer()).toBe(true);
    void client.sql.close;
    expect(client.recreer()).toBe(true);
  });
});

describe("signalerErreurSql", () => {
  test("ne touche à rien pour une erreur ordinaire", () => {
    expect(signalerErreurSql(new Error("deadlock detected"))).toBe(false);
  });
});
