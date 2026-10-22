import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { POST } from "./route";

describe("cron publish-scheduled", () => {
  const ancien = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = "secret-test";
  });
  afterEach(() => {
    if (ancien === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = ancien;
  });

  test("sans jeton valide : 401, aucune requête SQL", async () => {
    const sans = await POST(new Request("http://x/api/cron/publish-scheduled", { method: "POST" }));
    const faux = await POST(
      new Request("http://x/api/cron/publish-scheduled", { method: "POST", headers: { authorization: "Bearer autre" } }),
    );
    expect(sans.status).toBe(401);
    expect(faux.status).toBe(401);
  });

  test("CRON_SECRET absent : refuse même un jeton « Bearer undefined »", async () => {
    delete process.env.CRON_SECRET;
    const reponse = await POST(
      new Request("http://x/api/cron/publish-scheduled", { method: "POST", headers: { authorization: "Bearer undefined" } }),
    );
    expect(reponse.status).toBe(401);
  });
});
