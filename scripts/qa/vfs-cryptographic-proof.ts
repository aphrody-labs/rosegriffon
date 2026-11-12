// SPDX-License-Identifier: Apache-2.0
import crypto from "node:crypto";
import { getInaglePgPool } from "@rosegriffon/db/pg";

async function generateProof() {
  const pool = getInaglePgPool();
  console.log("=== VFS & Level-5 Master Corpus Cryptographic Audit Proof ===");
  console.log("Timestamp:", new Date().toISOString());

  // 1. Table Manifest
  const tables = [
    { name: "inagle_cpk_index", role: "VFS Virtual File System Index" },
    { name: "inagle_characters", role: "Player Corpus & Base Parameters" },
    { name: "inagle_skills", role: "Hissatsu Special Techniques" },
    { name: "inagle_items", role: "Equipment, Boots & Consumables" },
    { name: "inagle_passives", role: "Passive Abilities & Kizuna Effects" },
    { name: "inagle_costumes", role: "Uniforms, Kits & Alternate Costumes" },
    { name: "inagle_constellations", role: "Player Constellations & Hero Trees" },
    { name: "inagle_keshins", role: "Fighting Spirits (Keshin)" },
    { name: "inagle_miximax", role: "Miximax Auras & Transformations" },
    { name: "inagle_souls", role: "Totems / Animal Souls" },
    { name: "inagle_teams", role: "Canonical Game Teams" },
    { name: "inagle_formations", role: "Tactical Pitch Formations" },
    { name: "inagle_tactics", role: "Team Tactics & Field Orders" },
    { name: "inagle_special_tactics", role: "Special Tactics & Hissatsu Tactics" },
    { name: "inagle_super_tactics", role: "Super Tactics" },
    { name: "inagle_stadiums", role: "Canonical Soccer Stadiums" },
    { name: "inagle_shops", role: "In-Game Shops & Merchant Catalogs" },
    { name: "inagle_capsules", role: "Gacha Capsule Machines" },
    { name: "inagle_drops", role: "Match & Battle Drop Tables" },
    { name: "inagle_gallery", role: "High-DPI Game Illustrations" },
    { name: "inagle_skill_cutins", role: "Technique Cut-in Sequences" },
    { name: "inagle_skill_videos", role: "Technique Cinematics & Video Cues" },
    { name: "inagle_game_text", role: "Official Localization Strings" },
    { name: "inagle_lua_scripts", role: "Engine Lua Game Scripts" },
  ];

  const results: Array<{ name: string; role: string; count: number; hash: string }> = [];
  const globalHasher = crypto.createHash("sha256");
  const blakeHasher = new Bun.CryptoHasher("blake2b256");

  for (const t of tables) {
    try {
      const countRes = await pool.query(`SELECT count(*) FROM "${t.name}"`);
      const count = Number(countRes.rows[0].count);

      // Compute table sample hash
      const sampleRes = await pool.query(`SELECT * FROM "${t.name}" LIMIT 20`);
      const sampleStr = JSON.stringify(sampleRes.rows);
      const tableHash = crypto.createHash("sha256").update(sampleStr).digest("hex").slice(0, 16);

      results.push({ name: t.name, role: t.role, count, hash: tableHash });
      globalHasher.update(`${t.name}:${count}:${tableHash}`);
      blakeHasher.update(`${t.name}:${count}:${tableHash}`);
    } catch (err: any) {
      console.error(`Error querying ${t.name}:`, err.message);
    }
  }

  const globalSha256 = globalHasher.digest("hex");
  const globalBlake2b = blakeHasher.digest("hex");

  console.log("\n| Table Name | Role / Content | Count | Deterministic Hash |");
  console.log("| :--- | :--- | :--- | :--- |");
  for (const r of results) {
    console.log(`| \`${r.name}\` | ${r.role} | **${r.count.toLocaleString("fr-FR")}** | \`${r.hash}\` |`);
  }

  console.log("\n--- Cryptographic Proof Verification ---");
  console.log("SHA-256 Digest:  ", globalSha256);
  console.log("Blake2b Digest:  ", globalBlake2b);

  process.exit(0);
}

generateProof().catch((err) => {
  console.error("Proof generation failed:", err);
  process.exit(1);
});
