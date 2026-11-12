// SPDX-License-Identifier: Apache-2.0
import { getInaglePgPool, getPgPool } from "@rosegriffon/db/pg";

async function main() {
  try {
    const inagle = getInaglePgPool();
    const res = await inagle.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log("Inagle tables (" + res.rows.length + "):", res.rows.map(r => r.table_name));
    
    // Check inagle_cpk_index count
    if (res.rows.some(r => r.table_name === "inagle_cpk_index")) {
      const cpkCount = await inagle.query("SELECT count(*) FROM inagle_cpk_index");
      console.log("inagle_cpk_index count:", cpkCount.rows[0].count);
    }
    
    // Check all non-empty tables in Inagle
    const allTables = await inagle.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log("\n--- Populated Inagle Tables ---");
    for (const r of allTables.rows) {
      try {
        const c = await inagle.query(`SELECT count(*) FROM "${r.table_name}"`);
        const count = Number(c.rows[0].count);
        if (count > 0) {
          console.log(`${r.table_name}: ${count}`);
        }
      } catch {}
    }
  } catch (err: any) {
    console.error("Inagle query error:", err.message);
  }

  try {
    const rg = getPgPool();
    const rgRes = await rg.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log("RG tables (" + rgRes.rows.length + "):", rgRes.rows.map(r => r.table_name));
  } catch (err: any) {
    console.error("RG query error:", err.message);
  }

  process.exit(0);
}

main();
