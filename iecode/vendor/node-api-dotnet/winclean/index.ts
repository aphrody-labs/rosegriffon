import { resolve, dirname } from "node:path";
// Winclean.Bun (the AOT [JSExport] module) lives in the parent winclean repo,
// 3 levels up from here (packages/node-api-dotnet/winclean/).
import type * as Native from "../../../src/Winclean.Bun/bin/Winclean.Bun";

const repoRoot =
  Bun.env.WINCLEAN_ROOT && Bun.env.WINCLEAN_ROOT.length > 0
    ? Bun.env.WINCLEAN_ROOT
    : resolve(import.meta.dir, "../../..");

const nodeBinaryPath = resolve(repoRoot, "src/Winclean.Bun/bin/Winclean.Bun.node");

if (Bun.file(nodeBinaryPath).size === 0) {
  throw new Error(
    `Winclean.Bun.node not found at ${nodeBinaryPath}.\n` +
      `Build it first: dotnet publish src/Winclean.Bun -c Release -r win-x64`
  );
}

const dlopenTarget: { exports: unknown } = { exports: {} };
process.dlopen(dlopenTarget, nodeBinaryPath);
const native = dlopenTarget.exports as any;

// Initialize Windows App SDK
const sdk = native.WinAppSdkInfo;
if (sdk) {
  const binaryDir = dirname(nodeBinaryPath);
  const ok = sdk.initializeFrom(binaryDir);
  if (!ok) {
    console.warn("Failed to initialize Windows App SDK bootstrap:", sdk.getInitDiagnostics());
  }
}

// 1. Core WinClean APIs
export const core = {
  processes: native.Processes as typeof Native.Processes & {
    getPriority(pid: number): string;
    setPriority(pid: number, priority: string): boolean;
    getAffinity(pid: number): Native.AffinityInfo | undefined;
    setAffinity(pid: number, mask: number): boolean;
    trimWorkingSet(pid: number): boolean;
    setEcoMode(pid: number, enable: boolean): boolean;
    getEcoMode(pid: number): boolean;
  },
  startup: native.Startup as typeof Native.Startup & {
    getEntries(): Native.JSStartupEntry[];
    addEntry(name: string, path: string, isSystem: boolean): boolean;
    deleteEntry(name: string, isSystem: boolean): boolean;
  },
  services: native.WindowsServices as typeof Native.WindowsServices,
  registry: native.RegistryAccess as typeof Native.RegistryAccess,
  gpu: native.Gpu as {
    getHagsMode(): number;
    setHagsMode(mode: number): void;
    getGpuPreferences(): Native.JSGpuPreferenceEntry[];
    setGpuPreference(exePath: string, preferenceCode: number): void;
    removeGpuPreference(exePath: string): boolean;
  },
  power: native.PowerPlans as typeof Native.PowerPlans & {
    getPowerPlans(): Native.JSPowerPlanInfo[];
  },
  defender: native.Defender as {
    getStatus(): Native.JSDefenderStatus;
    setFeatureEnabled(featureName: string, enabled: boolean): boolean;
    updateSignatures(): boolean;
    startScan(quick: boolean): boolean;
  },
  firewall: native.Firewall as {
    getStatus(): Native.JSFirewallStatus;
    setProfileEnabled(profileName: string, enabled: boolean): boolean;
    resetDefaults(): boolean;
  },
  memory: native.Memory as {
    purgeStandbyList(lowPriorityOnly: boolean): boolean;
    emptyWorkingSets(): boolean;
  },
  explorer: native.Explorer as {
    clearExplorerCaches(): boolean;
    getThirdPartyContextMenus(): string[];
  },
  network: native.Network as {
    getNetworkAdapters(): Native.JSNetworkAdapterInfo[];
    getTcpConnections(stateFilter?: string): Native.JSTcpConnectionInfo[];
  },
  tasks: native.ScheduledTasks as {
    getTasks(): Native.JSScheduledTaskInfo[];
    enableTask(taskPath: string): boolean;
    disableTask(taskPath: string): boolean;
    runTask(taskPath: string): boolean;
  },
  hardware: native.Hardware as {
    getInfo(): Native.JSSystemHardwareInfo;
  },
  systemStats: native.SystemStats as {
    getCpuUsage(): number;
    lastCpuUsage: number;
    getMemoryInfo(): Native.JSMemoryInfo;
    countStartupEntries(): number;
    generateProfileAsync(): Promise<string>;
  },
  elevation: native.Elevation as {
    isAdministrator(): boolean;
    relaunchAsAdmin(executablePath: string, args?: string): boolean;
  },
  fileSystemSearch: native.FileSystemSearch as {
    fastScanDirectory(path: string, searchPattern?: string): string[];
    queryWindowsIndexer(filenameQuery: string): string[];
  },
  search: native.SystemSearch as {
    queryAsync(searchTerm: string): Promise<string[]>;
  },
  database: native.DatabaseAccess as {
    getDatabasePath(): string;
  }
};

// 2. Native Win32 APIs
export const win32 = {
  kernel32: native.Win32Kernel32 as {
    getProcessId(): number;
    getThreadId(): number;
    getLastErrorCode(): number;
    sleepMs(ms: number): void;
  },
  user32: native.Win32User32 as {
    getForeground(): number;
    setForeground(hwnd: number): boolean;
    findWindow(className: string | null, windowName: string | null): number;
    getWindowText(hwnd: number): string;
    setWindowText(hwnd: number, text: string): boolean;
    isVisible(hwnd: number): boolean;
    show(hwnd: number, cmd: number): boolean;
    getMetrics(index: number): number;
  },
  shell32: native.Win32Shell32 as {
    execute(hwnd: number, operation: string, file: string, parameters: string | null, directory: string | null, showCmd: number): number;
    queryRecycleBin(rootPath: string | null): Native.RecycleBinInfo;
    emptyRecycleBin(hwnd: number, rootPath: string | null, flags: number): boolean;
  }
};

// 3. Windows App SDK APIs
export const appsdk = {
  info: native.WinAppSdkInfo as typeof Native.WinAppSdkInfo & {
    getAppInstallerInfo(): string;
  },
  appData: native.AppData as typeof Native.AppData,
  clipboard: native.ClipboardText as typeof Native.ClipboardText,
  userInfo: native.UserInfo as typeof Native.UserInfo,
  appearance: native.SystemAppearance as typeof Native.SystemAppearance,
  powerManager: native.PowerManagerInfo as {
    getRemainingChargePercent(): number;
    getRemainingDischargeTimeSeconds(): number;
    getPowerSupplyStatus(): string;
    getBatteryStatus(): string;
    getEnergySaverStatus(): string;
  }
};

// 4. Arbitrary flat Win32 via bun:ffi (no AOT rebuild needed to reach new APIs).
export * as ffi from "./win32-ffi";

// 5. Launch + control the WinClean WinUI 3 app (out-of-process; see winui.ts).
export * as winui from "./winui";

// 6. Restyle any window (Mica/Acrylic/dark/corners) via dwmapi — no app change.
export * as dwm from "./dwm";

// 7. Full UI Automation of a running WinUI 3 app (drives real XAML controls).
export * as uia from "./uia";

// 8. Author WinUI 3 XAML from Bun (renders XAML strings in a host window).
export * as xaml from "./xaml";

// 9. Generated, typed Win32 surface (~4000 fns across 12 core DLLs) — bun:ffi.
//    (`win32` above is the curated N-API trio; `win32api` is the full generated set.)
export * as win32api from "./win32";

// 10. Dynamic .NET 10 BCL + WinRT via the node-api-dotnet fork's CLR host.
export * as dotnet from "./dotnet";

// 11. WUX — JSX → native WinUI 3 (a modern, native React-Native-Windows core).
export * as wux from "./wux";
