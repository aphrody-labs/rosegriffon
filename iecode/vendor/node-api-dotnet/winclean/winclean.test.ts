import { core, win32, appsdk } from "./index";
import { test, expect } from "bun:test";

test("winclean-framework integration test", async () => {
  // Test AppSDK
  console.log("=== AppSDK Test ===");
  console.log("Theme:", appsdk.appearance.getTheme());
  console.log("Accent:", appsdk.appearance.getAccentHex());
  console.log("Battery:", appsdk.powerManager.getRemainingChargePercent(), "%");
  console.log("User Name:", appsdk.userInfo.getCurrentDisplayName());
  expect(appsdk.appearance.getTheme()).toBeTypeOf("string");

  // Test System Stats
  console.log("=== System Stats Test ===");
  const memory = core.systemStats.getMemoryInfo();
  console.log("Memory Total GB:", memory.totalGb);
  console.log("Memory Used GB:", memory.usedGb);
  console.log("Memory Available GB:", memory.availableGb);
  expect(memory.totalGb).toBeGreaterThan(0);

  // Test System Profile Async
  const profileJson = await core.systemStats.generateProfileAsync();
  console.log("Generated System Profile JSON:", profileJson);
  const profile = JSON.parse(profileJson);
  expect(profile).toHaveProperty("cpu");
  expect(profile).toHaveProperty("ram");

  // Test Defender
  console.log("=== Defender Test ===");
  const defender = core.defender.getStatus();
  console.log("Defender Antivirus Active:", defender.antivirusEnabled);
  console.log("Defender Engine Version:", defender.engineVersion);
  expect(defender).toHaveProperty("antivirusEnabled");

  // Test Firewall
  console.log("=== Firewall Test ===");
  const firewall = core.firewall.getStatus();
  console.log("Firewall Domain Profile:", firewall.domainEnabled);
  console.log("Firewall Rules Count:", firewall.totalRules);
  expect(firewall).toHaveProperty("totalRules");

  // Test Database
  console.log("=== Database Path Test ===");
  const dbPath = core.database.getDatabasePath();
  console.log("SQLite Database Path:", dbPath);
  expect(dbPath).toContain("winclean.db");

  // Test Search Indexer Async
  console.log("=== Search Indexer Async Test ===");
  try {
    const searchResults = await core.search.queryAsync("Winclean");
    console.log(`Search query found ${searchResults.length} items`);
    expect(Array.isArray(searchResults)).toBe(true);
  } catch (err) {
    console.log("Windows Search query failed (expected if WSearch service is disabled or indexing is rebuilding):", err);
  }

  // Test Win32 APIs
  console.log("=== Win32 APIs Test ===");
  const pid = win32.kernel32.getProcessId();
  console.log("Current Process ID via Kernel32:", pid);
  expect(pid).toBe(process.pid);

  const foreground = win32.user32.getForeground();
  console.log("Foreground HWND:", foreground);
  console.log("Foreground Title:", win32.user32.getWindowText(foreground));
  expect(foreground).toBeTypeOf("number");

  const bin = win32.shell32.queryRecycleBin(null);
  console.log("Recycle Bin size:", bin.size, "bytes, Items count:", bin.numItems);
  expect(bin.success).toBe(true);
});
