# winclean-framework

A unified, high-performance bridge that exposes **all of Windows 11 to Bun** — Win32, COM/WinRT, the full .NET 10 BCL, and WinUI 3 — from TypeScript, in or out of process.

Three layers cover the whole surface:

1. **`bun:ffi`** — flat Win32 C ABIs, instant, no rebuild.
2. **N-API .NET module** (NativeAOT `node-api-dotnet` fork) — curated C# `[JSExport]` + a dynamic CLR host for *any* .NET/WinRT type.
3. **Out-of-process helpers** — for things that need their own UI thread/process (WinUI 3, UI Automation).

## Installation

```bash
bun add winclean-framework
```

## Surface map

| Namespace | What | Backing |
| --- | --- | --- |
| `core` | WinClean.Core optimization managers (processes, services, registry, defender, firewall, memory, GPU, power, tasks…) | N-API AOT `[JSExport]` |
| `appsdk` | Windows App SDK 1.8 (theming, clipboard, AppData, PowerManager, UserInfo) | N-API AOT (WinRT) |
| `win32` | Curated typed Win32 (Kernel32/User32/Shell32) with rich return types | N-API AOT |
| `ffi` | Bind *any* flat C export of *any* DLL at runtime (`ffi.bind`) + helpers | `bun:ffi` |
| `win32api` | **~4000 typed Win32 functions** across 12 core DLLs, generated from `Windows.Win32.winmd` | `bun:ffi` (lazy) |
| `dwm` | Restyle any window — Mica/Acrylic backdrop, dark title bar, rounded corners | `bun:ffi` (dwmapi) |
| `dotnet` | **Dynamic .NET 10**: `clr()` boots the CLR and projects *any* BCL/WinRT type; `loadWinRT()` exposes all `Windows.*` | node-api-dotnet host |
| `winui` | Launch + drive the WinClean WinUI 3 app (find/move/show/close its window) | out-of-process + user32 |
| `xaml` | **Author WinUI 3 XAML from TS** — render XAML strings, wire control events | out-of-process host |
| `uia` | Full UI Automation — read the control tree, invoke/select/toggle/setValue | out-of-process bridge |

Typed end to end: `win32api` from win32 metadata; `dotnet` / `loadWinRT` from generated `.d.ts` (regenerate with `bun run scripts/gen-dotnet-types.ts`).

## Usage

```typescript
import { core, appsdk, win32api, dwm, dotnet } from 'winclean-framework';

// WinClean optimization + App SDK
core.memory.purgeStandbyList(false);
console.log(appsdk.appearance.getTheme(), appsdk.powerManager.getRemainingChargePercent());

// ~4000 typed Win32 functions (generated), lazily bound
const buf = new Uint16Array(260);
const n = win32api.kernel32.GetSystemDirectoryW(buf, buf.length);
console.log(new TextDecoder('utf-16le').decode(new Uint8Array(buf.buffer, 0, n * 2)));
console.log(win32api.user32.GetSystemMetrics(0), 'x', win32api.user32.GetSystemMetrics(1));

// Dynamic .NET 10 BCL — any type, fully typed
const net = dotnet.clr();
net.System.Console.WriteLine('hello .NET from Bun');
const list = net.System.Math.Sqrt(2);

// Full WinRT (Windows.*), typed
const winrt = dotnet.loadWinRT();
console.log(winrt.Windows.System.Profile.AnalyticsInfo.VersionInfo.DeviceFamily);

// Restyle a window (Mica + dark) from Bun — works on any HWND
const fg = win32api.user32.GetForegroundWindow();
if (fg) dwm.applyFluentDark(fg);
```

### Author WinUI 3 XAML from Bun

```typescript
import { xaml } from 'winclean-framework';

const app = new xaml.XamlApp();
await app.ready();
await app.setContent(`
  <StackPanel xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
              xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Padding="24" Spacing="12">
    <TextBlock Text="Bonjour depuis Bun" FontSize="28"/>
    <Button x:Name="ok" Content="Click me"/>
    <TextBlock x:Name="status" Text="…"/>
  </StackPanel>`);
app.on('click', (e) => app.setText('status', `clicked: ${e.name}`));
```

### Drive a running WinUI 3 app (launch + UI Automation)

```typescript
import { winui, uia, dwm } from 'winclean-framework';

const { hwnd } = await winui.launchAndWait();   // PID-matched window
dwm.applyFluentDark(hwnd);                       // Mica + dark + rounded corners

const ui = new uia.UiaSession();
console.log(await ui.snapshot(Number(hwnd)));    // the live control tree
await ui.activate(Number(hwnd), { name: 'Processus' }); // navigate by control name
```

## Notes

- The dynamic `.node` host (`dotnet-host/`) and generated `.d.ts` are build artifacts (git-ignored). Build the host with a VS Dev Shell (NativeAOT needs the MSVC linker on PATH); generate typedefs with `scripts/gen-dotnet-types.ts`.
- WinRT runs on the net10 runtime without a `-windows` host; `loadWinRT()` loads the OS projection on demand.
