// Dynamic .NET / WinRT access from Bun — "exploit ALL of node-api-dotnet".
//
// Beyond the AOT [JSExport] surface (Winclean.Bun.node), the node-api-dotnet
// fork can host the CLR at runtime and project ANY .NET type into JS by
// reflection: the entire .NET 10 BCL plus every WinRT projection (Windows.* /
// Microsoft.*) — no per-API wrapper, no rebuild. This loads that dynamic host.
//
//   import { clr } from "winclean-framework";
//   const net = clr();
//   net.System.Console.WriteLine("hello from .NET, via Bun");
//   const os = net.System.Environment.OSVersion.VersionString;
//
// Requires the fork's host artifacts assembled under ./dotnet-host/
// (win-x64/Microsoft.JavaScript.NodeApi.node + net10.0/*.DotNetHost.dll).
// Build + assemble: see src/Winclean.Win32Gen sibling note / project memory.

import { Glob } from "bun";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);

// Host helpers on the dynamic root, beyond the projected .NET namespaces.
interface DotNetHostExtras {
  load(assemblyNameOrPath: string): void;
}

// The dynamic .NET root. The generated .d.ts under ./dotnet-host/types augment
// the 'node-api-dotnet' module with typed namespaces (System.*, …), so member
// access like clr().System.Math.Sqrt is fully typed from C# metadata.
export type Clr = typeof import("node-api-dotnet") & DotNetHostExtras;

interface NativeHost {
  initialize(
    targetFramework: string,
    managedHostPath: string,
    req: NodeRequire,
    importModule: (path: string) => Promise<unknown>,
  ): Clr;
}

function hostDir(): string {
  // dotnet-host/ sits alongside this module inside the fork.
  return resolve(import.meta.dir, "dotnet-host");
}

const importModule = (path: string): Promise<unknown> => import(path);

let cached: Clr;

// Boot the CLR (once per process) and return the dynamic .NET root object.
export function clr(targetFramework = "net10.0"): Clr {
  if (cached) {
    return cached;
  }
  const dir = hostDir();
  const nodePath = resolve(dir, "win-x64/Microsoft.JavaScript.NodeApi.node");
  if (Bun.file(nodePath).size === 0) {
    throw new Error(
      `node-api-dotnet host not assembled at ${nodePath}.\n` +
        `Build the fork host (net10/win-x64) and copy artifacts into dotnet-host/.`,
    );
  }
  const nativeHost = require(nodePath) as NativeHost;
  const managedHostPath = resolve(dir, `${targetFramework}/Microsoft.JavaScript.NodeApi.DotNetHost.dll`);
  cached = nativeHost.initialize(targetFramework, managedHostPath, require, importModule);
  return cached;
}

// Convenience: load an additional assembly (e.g. "System.Net.Http") so its
// namespaces become available on the clr() root.
export function load(assemblyNameOrPath: string, targetFramework = "net10.0"): void {
  const net = clr(targetFramework);
  net.load(assemblyNameOrPath);
}

// Load the full OS WinRT projection so the entire Windows.* surface (Storage,
// Devices, Media, Networking, System, Globalization, Security…) is callable:
//   const net = dotnet.loadWinRT();
//   net.Windows.System.Profile.AnalyticsInfo.VersionInfo.DeviceFamily;
// Auto-discovers Microsoft.Windows.SDK.NET in the NuGet cache; pass projectionDir to override.
export function loadWinRT(projectionDir?: string): Clr {
  const net = clr();
  let dir = projectionDir;
  if (!dir) {
    const cache = Bun.env.NUGET_PACKAGES ?? resolve(Bun.env.USERPROFILE ?? "", ".nuget/packages");
    const glob = new Glob("microsoft.windows.sdk.net.ref/*/lib/net*/Microsoft.Windows.SDK.NET.dll");
    for (const match of glob.scanSync(cache)) {
      dir = resolve(cache, match, "..");
      break;
    }
  }
  if (!dir) {
    throw new Error("Windows SDK .NET projection not found in NuGet cache; pass projectionDir");
  }
  net.load(resolve(dir, "WinRT.Runtime.dll"));
  net.load(resolve(dir, "Microsoft.Windows.SDK.NET.dll"));
  return net;
}
