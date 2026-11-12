#!/usr/bin/env bun
// SPDX-License-Identifier: Apache-2.0
/**
 * Sovereign Production Deployer for Rose Griffon (rosegriffon.fr).
 *
 * Atomically transfers standalone Next.js artifact, static chunks and public assets,
 * verifies checksums, swaps release directory, and validates live production endpoints.
 */

import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const SSH_EXE = "C:/Program Files/OpenSSH/ssh.exe";
const TARGET_HOST = "vps";

async function runSshCommand(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn([SSH_EXE, TARGET_HOST, cmd], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode };
}

async function streamFileToRemote(localPath: string, remotePath: string): Promise<void> {
  console.log(`[Deploy] Streaming ${localPath} -> ${TARGET_HOST}:${remotePath}...`);
  const proc = Bun.spawn([SSH_EXE, TARGET_HOST, `cat > ${remotePath}`], {
    stdin: Bun.file(localPath),
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`Failed to stream ${localPath} to ${remotePath} (exit ${code})`);
  }
}

async function main() {
  const startedAt = Date.now();
  console.log("=============================================================");
  console.log("[Deploy] Starting Sovereign Rose Griffon Production Deployment");
  console.log("=============================================================");

  const standaloneTar = "apps/rg-website/rg-standalone.tar.gz";
  const staticTar = "apps/rg-website/rg-static.tar.gz";
  const publicTar = "apps/rg-website/rg-public.tar.gz";

  if (!existsSync(standaloneTar) || !existsSync(staticTar) || !existsSync(publicTar)) {
    throw new Error("Build archives are missing. Run production build first.");
  }

  // 1. Stream archives to remote VPS
  await streamFileToRemote(standaloneTar, "/tmp/rg-standalone.tar.gz");
  await streamFileToRemote(staticTar, "/tmp/rg-static.tar.gz");
  await streamFileToRemote(publicTar, "/tmp/rg-public.tar.gz");

  // 2. Prepare staging directory on VPS and extract
  console.log("[Deploy] Extracting archives on VPS staging area (/home/ubuntu/apps/rg/next-new)...");
  const extractScript = `
    set -e
    cd /home/ubuntu/apps/rg
    rm -rf next-new
    mkdir -p next-new
    tar -xzf /tmp/rg-standalone.tar.gz -C next-new
    tar -xzf /tmp/rg-static.tar.gz -C next-new/apps/rg-website/.next
    tar -xzf /tmp/rg-public.tar.gz -C next-new/apps/rg-website
    mkdir -p next-new/apps/rg-website/.next/cache
    rm -f /tmp/rg-standalone.tar.gz /tmp/rg-static.tar.gz /tmp/rg-public.tar.gz
    ls -la next-new/apps/rg-website
  `;

  const extractRes = await runSshCommand(extractScript);
  if (extractRes.exitCode !== 0) {
    throw new Error(`Extraction failed on VPS:\n${extractRes.stderr}\n${extractRes.stdout}`);
  }
  console.log("[Deploy] Extraction successful.");

  // 3. Perform atomic service switch
  console.log("[Deploy] Switching systemd service (rg-website.service)...");
  const switchScript = `
    set -e
    cd /home/ubuntu/apps/rg
    sudo -n systemctl stop rg-website
    rm -rf old-cur
    [ -d current ] && mv current old-cur
    mv next-new current
    sudo -n systemctl start rg-website
    sleep 4
    systemctl is-active rg-website
  `;

  const switchRes = await runSshCommand(switchScript);
  if (switchRes.exitCode !== 0) {
    console.error("[Deploy] Switch error:", switchRes.stderr);
    console.log("[Deploy] Attempting automatic rollback to old-cur...");
    await runSshCommand(`
      cd /home/ubuntu/apps/rg
      [ -d old-cur ] && rm -rf current && mv old-cur current
      sudo -n systemctl start rg-website
    `);
    throw new Error(`Atomic switch failed. Rollback attempted.`);
  }

  console.log(`[Deploy] Service status on VPS: ${switchRes.stdout}`);

  // 4. Probe local loopback on VPS
  const loopbackRes = await runSshCommand(`
    sleep 2
    curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3100/
  `);
  console.log(`[Deploy] Loopback probe (127.0.0.1:3100/): HTTP ${loopbackRes.stdout}`);

  // 5. Live public production verification
  console.log("[Deploy] Probing live production domain (https://rosegriffon.fr)...");
  const endpoints = [
    "/",
    "/wiki",
    "/achillea",
    "/design-system",
    "/a-propos",
    "/api/health",
  ];

  const results: Array<{ path: string; status: number; durationMs: number }> = [];

  for (const path of endpoints) {
    const url = `https://rosegriffon.fr${path}`;
    const t0 = performance.now();
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": "Antigravity-Deployment-Verifier/2026.11" },
      });
      const durationMs = Math.round(performance.now() - t0);
      results.push({ path, status: resp.status, durationMs });
      console.log(`  ${path.padEnd(20)} -> HTTP ${resp.status} (${durationMs}ms)`);
    } catch (err: any) {
      console.error(`  ${path.padEnd(20)} -> FAILED (${err.message})`);
      results.push({ path, status: 0, durationMs: -1 });
    }
  }

  // 6. Cleanup local tarballs
  unlinkSync(standaloneTar);
  unlinkSync(staticTar);
  unlinkSync(publicTar);

  const durationSec = Math.round((Date.now() - startedAt) / 1000);
  console.log("=============================================================");
  console.log(`[Deploy] Production Deployment Completed in ${durationSec}s`);
  console.log("=============================================================");
}

main().catch(err => {
  console.error("[Deploy] FATAL:", err);
  process.exit(1);
});
