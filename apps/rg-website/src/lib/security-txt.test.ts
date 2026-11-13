import { describe, expect, it } from "bun:test";

import { GET } from "../app/.well-known/security.txt/route";
import { securityTxt } from "./security-txt";

describe("security.txt (RFC 9116)", () => {
  const maintenant = new Date("2026-11-05T10:00:00.123Z");
  const texte = securityTxt("https://rosegriffon.fr/", maintenant);
  const champs = texte
    .trim()
    .split("\n")
    .map((l) => l.split(": ")[0]);

  it("has the required fields, one Expires and one Canonical", () => {
    expect(texte).toContain("Contact: mailto:contact@rosegriffon.fr\n");
    expect(texte).toContain(
      "Contact: https://rosegriffon.fr/a-propos/contact\n",
    );
    expect(texte).toContain("Preferred-Languages: fr, en\n");
    expect(texte).toContain(
      "Canonical: https://rosegriffon.fr/.well-known/security.txt\n",
    );
    expect(champs.filter((c) => c === "Expires")).toHaveLength(1);
    expect(champs.filter((c) => c === "Canonical")).toHaveLength(1);
  });

  it("expires one year ahead, RFC 3339 without milliseconds", () => {
    expect(texte).toContain("Expires: 2027-11-05T10:00:00Z\n");
  });

  it("is served as text/plain UTF-8 with a future Expires", async () => {
    const reponse = GET();
    expect(reponse.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8",
    );
    const corps = await reponse.text();
    const expire = Date.parse(/Expires: (.+)/.exec(corps)![1]!);
    expect(expire).toBeGreaterThan(Date.now() + 360 * 86_400_000);
  });
});
