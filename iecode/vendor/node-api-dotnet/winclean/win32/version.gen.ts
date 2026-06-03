// AUTO-GENERATED from Windows.Win32.winmd — do not edit by hand.
import { loadModule } from "./_runtime";

export const version = loadModule("version.dll", {
  "GetFileVersionInfoA": { a: ["ptr", "u32", "u32", "ptr"], r: "i32" },
  "GetFileVersionInfoExA": { a: ["u32", "ptr", "u32", "u32", "ptr"], r: "i32" },
  "GetFileVersionInfoExW": { a: ["u32", "ptr", "u32", "u32", "ptr"], r: "i32" },
  "GetFileVersionInfoSizeA": { a: ["ptr", "ptr"], r: "u32" },
  "GetFileVersionInfoSizeExA": { a: ["u32", "ptr", "ptr"], r: "u32" },
  "GetFileVersionInfoSizeExW": { a: ["u32", "ptr", "ptr"], r: "u32" },
  "GetFileVersionInfoSizeW": { a: ["ptr", "ptr"], r: "u32" },
  "GetFileVersionInfoW": { a: ["ptr", "u32", "u32", "ptr"], r: "i32" },
  "VerFindFileA": { a: ["u32", "ptr", "ptr", "ptr", "ptr", "ptr", "ptr", "ptr"], r: "u32" },
  "VerFindFileW": { a: ["u32", "ptr", "ptr", "ptr", "ptr", "ptr", "ptr", "ptr"], r: "u32" },
  "VerInstallFileA": { a: ["u32", "ptr", "ptr", "ptr", "ptr", "ptr", "ptr", "ptr"], r: "u32" },
  "VerInstallFileW": { a: ["u32", "ptr", "ptr", "ptr", "ptr", "ptr", "ptr", "ptr"], r: "u32" },
  "VerQueryValueA": { a: ["ptr", "ptr", "ptr", "ptr"], r: "i32" },
  "VerQueryValueW": { a: ["ptr", "ptr", "ptr", "ptr"], r: "i32" },
} as const);
