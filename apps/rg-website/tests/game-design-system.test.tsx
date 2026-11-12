// SPDX-License-Identifier: Apache-2.0
import { describe, expect, test } from "bun:test";
import { AffinityChip, SlantedContainer, GameImmersiveBackground } from "../src/components/ui/game-design-system";

describe("GameDesignSystem Component Suite", () => {
  test("AffinityChip applique la couleur et le libellé de l'affinité élémentaire", () => {
    const windChip = AffinityChip({ affinity: "wind", showLabel: true });
    expect(windChip.props.style?.color).toBe("#00FFFF");
    expect(windChip.props.className).toContain("border-cyan-400/50");

    const fireChip = AffinityChip({ affinity: "fire", showLabel: true });
    expect(fireChip.props.style?.color).toBe("#FF3B30");
    expect(fireChip.props.className).toContain("border-red-500/50");

    const forestChip = AffinityChip({ affinity: "forest", showLabel: true });
    expect(forestChip.props.style?.color).toBe("#34C759");

    const mountainChip = AffinityChip({ affinity: "mountain", showLabel: true });
    expect(mountainChip.props.style?.color).toBe("#FF9500");
  });

  test("SlantedContainer applique l'inclinaison de -10 degrés et l'un-skew interne", () => {
    const slanted = SlantedContainer({ children: "HUD Content", glowColor: "#00FFFF" });
    expect(slanted.props.className).toContain("-skew-x-[10deg]");
    const inner = slanted.props.children;
    expect(inner.props.className).toContain("skew-x-[10deg]");
  });

  test("GameImmersiveBackground injecte les dégradés et textures de stade", () => {
    const bgStadium = GameImmersiveBackground({ variant: "stadium", showScanlines: true });
    expect(bgStadium.props.style?.background).toContain("radial-gradient");
    expect(bgStadium.props.style?.background).toContain("8, 116, 255");

    const bgCyber = GameImmersiveBackground({ variant: "cyber", showScanlines: false });
    expect(bgCyber.props.style?.background).toContain("0, 255, 255");
  });
});
