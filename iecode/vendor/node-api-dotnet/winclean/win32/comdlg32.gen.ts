// AUTO-GENERATED from Windows.Win32.winmd — do not edit by hand.
import { loadModule } from "./_runtime";

export const comdlg32 = loadModule("comdlg32.dll", {
  "ChooseColorA": { a: ["ptr"], r: "i32" },
  "ChooseColorW": { a: ["ptr"], r: "i32" },
  "ChooseFontA": { a: ["ptr"], r: "i32" },
  "ChooseFontW": { a: ["ptr"], r: "i32" },
  "CommDlgExtendedError": { a: [], r: "u32" },
  "FindTextA": { a: ["ptr"], r: "ptr" },
  "FindTextW": { a: ["ptr"], r: "ptr" },
  "GetFileTitleA": { a: ["ptr", "ptr", "u16"], r: "i16" },
  "GetFileTitleW": { a: ["ptr", "ptr", "u16"], r: "i16" },
  "GetOpenFileNameA": { a: ["ptr"], r: "i32" },
  "GetOpenFileNameW": { a: ["ptr"], r: "i32" },
  "GetSaveFileNameA": { a: ["ptr"], r: "i32" },
  "GetSaveFileNameW": { a: ["ptr"], r: "i32" },
  "PageSetupDlgA": { a: ["ptr"], r: "i32" },
  "PageSetupDlgW": { a: ["ptr"], r: "i32" },
  "PrintDlgA": { a: ["ptr"], r: "i32" },
  "PrintDlgExA": { a: ["ptr"], r: "i32" },
  "PrintDlgExW": { a: ["ptr"], r: "i32" },
  "PrintDlgW": { a: ["ptr"], r: "i32" },
  "ReplaceTextA": { a: ["ptr"], r: "ptr" },
  "ReplaceTextW": { a: ["ptr"], r: "ptr" },
} as const);
