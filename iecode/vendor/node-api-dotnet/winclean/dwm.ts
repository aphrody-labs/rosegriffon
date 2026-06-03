// Restyle ANY top-level window from Bun via dwmapi.dll (DwmSetWindowAttribute).
//
// These DWM attributes apply to any HWND — including another process's window —
// so Bun can give the WinClean WinUI 3 app (or any app) a Mica/Acrylic backdrop,
// dark title bar, and rounded corners without touching the app itself.
// Requires Windows 11 (build 22000+ for dark mode/corners, 22621+ for backdrop).

import { dlopen, FFIType, type Pointer, ptr } from "bun:ffi";

const dwmapi = dlopen("dwmapi.dll", {
  DwmSetWindowAttribute: {
    args: [FFIType.ptr, FFIType.u32, FFIType.ptr, FFIType.u32],
    returns: FFIType.i32, // HRESULT
  },
}).symbols;

// DWMWINDOWATTRIBUTE values.
const DWMWA = {
  USE_IMMERSIVE_DARK_MODE: 20,
  WINDOW_CORNER_PREFERENCE: 33,
  BORDER_COLOR: 34,
  CAPTION_COLOR: 35,
  TEXT_COLOR: 36,
  SYSTEMBACKDROP_TYPE: 38,
} as const;

// DWM_SYSTEMBACKDROP_TYPE.
export const Backdrop = {
  AUTO: 0,
  NONE: 1,
  MICA: 2,
  ACRYLIC: 3,
  MICA_ALT: 4,
} as const;
export type BackdropType = (typeof Backdrop)[keyof typeof Backdrop];

// DWM_WINDOW_CORNER_PREFERENCE.
export const Corner = {
  DEFAULT: 0,
  DONOTROUND: 1,
  ROUND: 2,
  ROUNDSMALL: 3,
} as const;
export type CornerPreference = (typeof Corner)[keyof typeof Corner];

function setDword(hwnd: Pointer, attribute: number, value: number): boolean {
  const buf = new Int32Array([value]);
  const hr = dwmapi.DwmSetWindowAttribute(hwnd, attribute, ptr(buf), 4);
  return hr === 0;
}

// Mica / Acrylic / etc. system backdrop behind the window.
export function setBackdrop(hwnd: Pointer, type: BackdropType): boolean {
  return setDword(hwnd, DWMWA.SYSTEMBACKDROP_TYPE, type);
}

// Dark (true) or light (false) title bar.
export function setDarkMode(hwnd: Pointer, enabled = true): boolean {
  return setDword(hwnd, DWMWA.USE_IMMERSIVE_DARK_MODE, enabled ? 1 : 0);
}

export function setCorner(hwnd: Pointer, preference: CornerPreference): boolean {
  return setDword(hwnd, DWMWA.WINDOW_CORNER_PREFERENCE, preference);
}

// Colors are 0x00BBGGRR (COLORREF). Pass -1 for "default", -2 for "none".
export function setCaptionColor(hwnd: Pointer, colorRef: number): boolean {
  return setDword(hwnd, DWMWA.CAPTION_COLOR, colorRef >>> 0);
}

export function setBorderColor(hwnd: Pointer, colorRef: number): boolean {
  return setDword(hwnd, DWMWA.BORDER_COLOR, colorRef >>> 0);
}

// Convenience: a modern Windows 11 look (dark Mica + rounded corners) in one call.
export function applyFluentDark(hwnd: Pointer): boolean {
  const a = setDarkMode(hwnd, true);
  const b = setBackdrop(hwnd, Backdrop.MICA);
  const c = setCorner(hwnd, Corner.ROUND);
  return a && b && c;
}
