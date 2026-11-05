import { describe, expect, test } from "bun:test";

import { videoLisibleNavigateur } from "./video";

describe("videoLisibleNavigateur", () => {
  test("accepte mp4 et webm", () => {
    expect(videoLisibleNavigateur("/storage/v1/object/public/assets/a/b.mp4")).toBe(true);
    expect(videoLisibleNavigateur("https://cdn.example/x.webm?v=2")).toBe(true);
  });

  test("refuse le QuickTime et les conteneurs non web", () => {
    expect(videoLisibleNavigateur("/storage/v1/object/public/assets/a/1279780296002109552.mov")).toBe(false);
    expect(videoLisibleNavigateur("/x/clip.MOV?download=1")).toBe(false);
    expect(videoLisibleNavigateur("/x/clip.mkv")).toBe(false);
  });
});
