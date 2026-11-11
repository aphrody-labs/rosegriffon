import { describe, expect, test } from "bun:test";
import { Ui } from "../src/ui/ui";

describe("@aphrody/nie-ui exports", () => {
  test("Ui class is exported and defined", () => {
    expect(Ui).toBeDefined();
  });
});
