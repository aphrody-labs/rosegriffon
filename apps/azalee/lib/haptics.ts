/**
 * Haptic feedback via Vibration API.
 * Silently no-ops on unsupported devices.
 */
export function haptic(type: "light" | "medium" | "heavy" = "light") {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;

  const patterns: Record<string, number> = {
    light: 10,
    medium: 20,
    heavy: 40,
  };

  try {
    navigator.vibrate(patterns[type]);
  } catch {
    // Silently fail
  }
}
