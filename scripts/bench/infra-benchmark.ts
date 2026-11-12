// SPDX-License-Identifier: Apache-2.0
/**
 * Rose Griffon Infrastructure Benchmark Suite (Late 2026)
 *
 * Measures sub-millisecond execution performance across:
 * 1. Auth: Purpose-bound session token minting and cryptographic verification
 * 2. Database: Query builder compilation and parameterization throughput
 * 3. API & Web: JSON response serialization and payload compression
 * 4. Bot Infra: Command dispatch and interaction route matching
 */
import {
  signAchilleaSessionToken,
  signAchilleaRealtimeToken,
} from "../../packages/rg-auth/src/achillea-session";
import {
  verifyAchilleaSessionToken,
  verifyAchilleaRealtimeToken,
} from "../../packages/achillea-core/src/auth";
import { PostgresQueryBuilder } from "../../packages/rg-db/src/postgres-client";

interface BenchResult {
  category: string;
  operation: string;
  iterations: number;
  durationMs: number;
  opsPerSec: number;
  avgLatencyUs: number;
}

const results: BenchResult[] = [];

async function benchmark(
  category: string,
  operation: string,
  iterations: number,
  fn: () => void | Promise<void>,
) {
  // Warmup
  const warmupCount = Math.min(Math.floor(iterations * 0.1), 100);
  for (let i = 0; i < warmupCount; i++) {
    await fn();
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    await fn();
  }
  const end = performance.now();
  const durationMs = end - start;
  const opsPerSec = Math.round((iterations / (durationMs / 1000)));
  const avgLatencyUs = Math.round((durationMs / iterations) * 1000);

  results.push({
    category,
    operation,
    iterations,
    durationMs: Number(durationMs.toFixed(2)),
    opsPerSec,
    avgLatencyUs,
  });
}

async function run() {
  console.info("================================================================================");
  console.info(" Rose Griffon Infrastructure & Sovereign Performance Benchmark Suite (Bun v1.4.4)");
  console.info("================================================================================");

  const SECRET = "rg-sovereign-production-key-2026-super-secure";
  const identity = {
    id: "222222222222222222",
    username: "EndouMamoru",
    avatar: "a_1234567890abcdef",
  };
  const now = Math.floor(Date.now() / 1000);

  // 1. Auth Minting
  await benchmark("Auth (Node Crypto HMAC)", "signAchilleaSessionToken", 10_000, () => {
    signAchilleaSessionToken(identity, SECRET, now, 3600);
  });

  await benchmark("Auth (Node Crypto HMAC)", "signAchilleaRealtimeToken", 10_000, () => {
    signAchilleaRealtimeToken(identity, SECRET, now);
  });

  // 2. Auth Verification (Web Crypto Subtle HMAC)
  const sessionToken = signAchilleaSessionToken(identity, SECRET, now, 3600);
  await benchmark("Auth (WebCrypto Subtle)", "verifyAchilleaSessionToken", 5_000, async () => {
    await verifyAchilleaSessionToken(sessionToken, SECRET, now + 10);
  });

  const realtimeToken = signAchilleaRealtimeToken(identity, SECRET, now);
  await benchmark("Auth (WebCrypto Subtle)", "verifyAchilleaRealtimeToken", 5_000, async () => {
    await verifyAchilleaRealtimeToken(realtimeToken, SECRET, now + 10);
  });

  // 3. Database Query Builder
  const mockExecutor = {
    async executeQuery() {
      return { rows: [] };
    },
  };

  await benchmark("DB (PostgresQueryBuilder)", "Select + Complex Where + Paging", 20_000, () => {
    const qb = new PostgresQueryBuilder(mockExecutor, "users");
    qb.select("id, username, elo, created_at")
      .eq("active", true)
      .gt("elo", 1500)
      .order("elo", { ascending: false })
      .range(0, 49);
  });

  await benchmark("DB (PostgresQueryBuilder)", "Upsert Builder (Conflict + Returning)", 20_000, () => {
    const qb = new PostgresQueryBuilder(mockExecutor, "player_stats");
    qb.upsert(
      { id: "stat_1", player_id: "p1", wins: 15, losses: 2, elo: 1850 },
      { onConflict: "id" },
    );
  });

  // 4. API Response Serialization
  const complexPayload = {
    status: "ok",
    service: "rg-api",
    timestamp: Date.now(),
    data: Array.from({ length: 50 }, (_, i) => ({
      id: `match_${i}`,
      homeTeam: { id: `team_${i}_h`, name: "Raimon Eleven", score: 3 },
      awayTeam: { id: `team_${i}_a`, name: "Teikoku Gakuen", score: 2 },
      timestamp: Date.now() - i * 60_000,
      metadata: { stadium: "Odaiba", weather: "Clear", viewers: 12500 + i * 100 },
    })),
  };

  await benchmark("API (JSON Engine)", "JSON.stringify (50 complex match records)", 10_000, () => {
    JSON.stringify(complexPayload);
  });

  const serialized = JSON.stringify(complexPayload);
  await benchmark("API (JSON Engine)", "JSON.parse (50 complex match records)", 10_000, () => {
    JSON.parse(serialized);
  });

  // 5. Compression Pipeline
  const payloadBuffer = Buffer.from(serialized);
  await benchmark("Compression (Bun Deflate)", "Bun.deflateSync (50 match records)", 5_000, () => {
    Bun.deflateSync(payloadBuffer);
  });

  const compressed = Bun.deflateSync(payloadBuffer);
  await benchmark("Decompression (Bun Inflate)", "Bun.inflateSync (50 match records)", 5_000, () => {
    Bun.inflateSync(compressed);
  });

  // 6. WebAssembly (WASM) Engine & Client VFS
  const { NieWasmEngine, getNieWasmInstance } = await import(
    "../../apps/rg-website/src/lib/wasm/nie-wasm-core"
  );
  const wasmInstance = await getNieWasmInstance();
  const wasmExports = wasmInstance.exports as any;
  const wasmEngine = new NieWasmEngine(
    Array.from({ length: 1_000 }, (_, i) => `data/dx11/menu/001_chara/c0100${i.toString().padStart(4, "0")}.g4tx`),
  );

  await benchmark("WASM (Native Instructions)", "calculate_power (100, 50, 120)", 50_000, () => {
    wasmExports.calculate_power(100, 50, 120);
  });

  await benchmark("WASM (Native Instructions)", "elemental_affinity (1, 4)", 50_000, () => {
    wasmExports.elemental_affinity(1, 4);
  });

  const testDataForCrc = new Uint8Array(10_240); // 10 KB buffer
  await benchmark("WASM Engine (CRC32)", "crc32 on 10 KB buffer", 20_000, () => {
    wasmEngine.crc32(testDataForCrc);
  });

  await benchmark("VFS Client Engine", "queryVfs across 1,000 game paths", 10_000, () => {
    wasmEngine.queryVfs("c01000050", 10);
  });

  // Format Table Output
  console.info("\nResults Summary:");
  console.info("---------------------------------------------------------------------------------------------------------");
  console.info(
    "Category".padEnd(28) +
      "Operation".padEnd(38) +
      "Iterations".padStart(12) +
      "Throughput (ops/s)".padStart(20) +
      "Avg Latency".padStart(14),
  );
  console.info("---------------------------------------------------------------------------------------------------------");

  for (const r of results) {
    console.info(
      r.category.padEnd(28) +
        r.operation.padEnd(38) +
        r.iterations.toLocaleString().padStart(12) +
        `${r.opsPerSec.toLocaleString()} ops/s`.padStart(20) +
        `${r.avgLatencyUs} µs`.padStart(14),
    );
  }
  console.info("---------------------------------------------------------------------------------------------------------");
  console.info(`Raw payload size: ${(payloadBuffer.byteLength / 1024).toFixed(2)} KB | Compressed size: ${(compressed.byteLength / 1024).toFixed(2)} KB | Ratio: ${(payloadBuffer.byteLength / compressed.byteLength).toFixed(2)}:1`);
  console.info("Benchmark successfully finished.\n");
}

run().catch(console.error);
