// SPDX-License-Identifier: Apache-2.0
import { expect, test } from "bun:test";
import { resolve } from "node:path";
import { existsSync, rmSync } from "node:fs";

test("MCP server handles initialize and tools/list via stdio", async () => {
  const mcpEntry = resolve(import.meta.dir, "index.ts");
  const proc = Bun.spawn([process.execPath, mcpEntry], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  const responses: any[] = [];
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  // Send initialize request
  const initRequest = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  });

  const toolsRequest = JSON.stringify({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });

  const callRequest = JSON.stringify({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "rg_status",
      arguments: {},
    },
  });

  proc.stdin.write(initRequest + "\n");
  proc.stdin.write(toolsRequest + "\n");
  proc.stdin.write(callRequest + "\n");
  proc.stdin.flush();
  proc.stdin.end();

  let accumulated = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    const lines = accumulated.split("\n");
    accumulated = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) {
        responses.push(JSON.parse(line.trim()));
      }
    }
  }

  await proc.exited;

  expect(responses.length).toBe(3);

  // Check initialize response
  const initRes = responses.find((r) => r.id === 1);
  expect(initRes).toBeDefined();
  expect(initRes.result.serverInfo.name).toBe("rosegriffon-mcp");

  // Check tools/list response
  const toolsRes = responses.find((r) => r.id === 2);
  expect(toolsRes).toBeDefined();
  expect(toolsRes.result.tools.length).toBeGreaterThanOrEqual(8);
  const toolNames = toolsRes.result.tools.map((t: any) => t.name);
  expect(toolNames).toContain("nie_headless_save_editor");
  expect(toolNames).toContain("nie_menu_capture");
  expect(toolNames).toContain("nie_memory_dump");
  expect(toolNames).toContain("nie_filmcraft_timeline");
  expect(toolNames).toContain("nie_headless_pipeline");

  // Check tools/call response
  const callRes = responses.find((r) => r.id === 3);
  expect(callRes).toBeDefined();
  expect(callRes.result.content[0].text).toContain("operational");
});

test("MCP server runs nie_headless_pipeline end-to-end", async () => {
  const mcpEntry = resolve(import.meta.dir, "index.ts");
  const testOutDir = resolve(process.cwd(), "target/mcp_test_pipeline");
  if (existsSync(testOutDir)) {
    rmSync(testOutDir, { recursive: true, force: true });
  }

  const proc = Bun.spawn([process.execPath, mcpEntry], {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });

  const responses: any[] = [];
  const reader = proc.stdout.getReader();
  const decoder = new TextDecoder();

  const pipelineCall = JSON.stringify({
    jsonrpc: "2.0",
    id: 42,
    method: "tools/call",
    params: {
      name: "nie_headless_pipeline",
      arguments: {
        outDir: testOutDir,
        slot: "002AB8F4-USERDATALIVE",
        level: 99,
        coins: 888888,
      },
    },
  });

  proc.stdin.write(pipelineCall + "\n");
  proc.stdin.flush();
  proc.stdin.end();

  let accumulated = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    accumulated += decoder.decode(value, { stream: true });
    const lines = accumulated.split("\n");
    accumulated = lines.pop() || "";
    for (const line of lines) {
      if (line.trim()) {
        responses.push(JSON.parse(line.trim()));
      }
    }
  }

  await proc.exited;

  const res = responses.find((r) => r.id === 42);
  expect(res).toBeDefined();
  expect(res.result).toBeDefined();

  const parsed = JSON.parse(res.result.content[0].text);
  expect(parsed.status).toBe("success");
  expect(parsed.save_report.slot).toBe("002AB8F4-USERDATALIVE");
  expect(parsed.memory_dump.base_address).toBe("0x140000000");
  expect(parsed.memory_dump.save_manager_address).toBe("0x142800000");
  expect(parsed.menu_capture.total_frames).toBeGreaterThanOrEqual(30);
  expect(parsed.filmcraft_timeline).toBeDefined();
  expect(parsed.filmcraft_timeline.clipsCount).toBeGreaterThanOrEqual(6);
  expect(parsed.filmcraft_timeline.smpteCues.length).toBeGreaterThanOrEqual(6);

  // Validate output files on disk
  expect(existsSync(resolve(testOutDir, "002AB8F4-USERDATALIVE.bin"))).toBe(
    true,
  );
  expect(existsSync(resolve(testOutDir, "nie_memory_dump.bin"))).toBe(true);
  expect(existsSync(resolve(testOutDir, "nie_memory_map.json"))).toBe(true);
  expect(existsSync(resolve(testOutDir, "frames/timeline.json"))).toBe(true);
  expect(
    existsSync(resolve(testOutDir, "frames/frame_00000_boot_00.png")),
  ).toBe(true);
});
