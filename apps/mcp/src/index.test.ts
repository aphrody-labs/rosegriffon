import { expect, test } from "bun:test";
import { resolve } from "node:path";

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
  expect(toolsRes.result.tools.length).toBeGreaterThanOrEqual(3);

  // Check tools/call response
  const callRes = responses.find((r) => r.id === 3);
  expect(callRes).toBeDefined();
  expect(callRes.result.content[0].text).toContain("operational");
});
