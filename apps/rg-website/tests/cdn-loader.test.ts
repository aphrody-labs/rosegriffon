import { describe, expect, test } from "bun:test";
import { discordSized } from "../cdn-loader";

describe("discordSized", () => {
  test("animated GIF becomes animated WebP at the next power of two", () => {
    expect(discordSized("https://cdn.discordapp.com/avatars/1/a_x.gif?size=256", 96)).toBe(
      "https://cdn.discordapp.com/avatars/1/a_x.webp?size=128&animated=true",
    );
  });

  test("static avatar keeps its format and gets a size", () => {
    expect(discordSized("https://cdn.discordapp.com/avatars/1/x.webp", 40)).toBe(
      "https://cdn.discordapp.com/avatars/1/x.webp?size=64",
    );
  });

  test("size is clamped to the Discord range", () => {
    expect(discordSized("https://cdn.discordapp.com/avatars/1/x.png", 5000)).toContain("size=4096");
    expect(discordSized("https://cdn.discordapp.com/avatars/1/x.png", 1)).toContain("size=16");
  });
});
