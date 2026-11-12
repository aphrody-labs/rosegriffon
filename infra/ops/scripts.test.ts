import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REPO_ROOT,
  loadInfra,
  renderUpstreams,
  resolveHost,
  service,
  services,
} from "../../packages/rg-config/infra.ts";
import {
  deployScript,
  migratePlan,
  rollbackScript,
  select,
  verifyScript,
} from "./scripts.ts";

const infra = loadInfra();
const prod = resolveHost(infra, "prod");

test("the committed upstreams match the registry", () => {
  const file = readFileSync(
    resolve(REPO_ROOT, "infra/docker/nginx/conf.d/00-upstreams.conf"),
    "utf8",
  );
  expect(file).toBe(renderUpstreams(infra));
});

test("select: all is the default stack, profiles are opt-in", () => {
  const all = select(infra, "all").map((s) => s.name);
  expect(all).toContain("core");
  expect(all).not.toContain("cron");
  expect(() => select(infra, "nope")).toThrow();
});

test("deploy exports host facts and never spells them twice", () => {
  const s = deployScript(
    prod,
    infra,
    {},
    select(infra, "core"),
    "origin/main",
    false,
  );
  expect(s).toContain(`export RG_SRV_ROOT='${prod.srv_root}'`);
  expect(s).toContain("up -d --wait --wait-timeout 300 core");
  expect(s).not.toContain("--remove-orphans");
});

test("profiled services enable their profile", () => {
  const s = deployScript(
    prod,
    infra,
    {},
    select(infra, "cron"),
    "origin/main",
    false,
  );
  expect(s).toContain("docker compose --profile cron-split up -d");
});

test("verify probes health and vhosts", () => {
  const s = verifyScript(
    prod,
    infra,
    { RG_DOMAIN: "example.test" },
    select(infra, "core"),
  );
  expect(s).toContain("probe core 8810 /health");
  expect(s).toContain("api.example.test");
});

test("rollback pins RG_TAG without building", () => {
  expect(
    rollbackScript(prod, infra, {}, select(infra, "all"), "abc1234", true),
  ).toContain("RG_TAG='abc1234' docker compose up -d --wait --no-build");
});

test("migrate: build on target, stop, sync state, start, verify", () => {
  const to = resolveHost(infra, "build");
  const plan = migratePlan(
    infra,
    {},
    service(infra, "core"),
    prod,
    to,
    "origin/main",
  );
  expect(plan.map((p) => p.title.split(" ")[0])).toEqual([
    "prepare",
    "stop",
    "sync",
    "start",
    "verify",
  ]);
  expect(plan[2]!.host.key).toBe(prod.key);
  expect(plan[2]!.script).toContain(`rsync -aH --delete`);
  expect(plan[2]!.script).toContain(`${to.srv_root}/state/`);
  expect(() =>
    migratePlan(infra, {}, service(infra, "core"), prod, prod, "x"),
  ).toThrow();
});

test("every compose service is in the registry", () => {
  const compose = Bun.YAML.parse(
    readFileSync(resolve(REPO_ROOT, "compose.yaml"), "utf8"),
  ) as {
    services: Record<string, unknown>;
  };
  const known = new Set(services(infra).map((s) => s.name));
  for (const name of Object.keys(compose.services))
    expect(known.has(name)).toBe(true);
});

test("deploy ships images from the build role instead of building on prod", () => {
  const build = resolveHost(infra, "build");
  const s = deployScript(
    prod,
    infra,
    {},
    select(infra, "all"),
    "origin/main",
    true,
    build,
  );
  expect(s).toContain(`for h in '${build.ssh}' '${build.key}-public'; do`);
  expect(s).toContain(
    `ssh -n -o BatchMode=yes "$ship_ssh" "docker save $imgs" | docker load`,
  );
  expect(s).toContain("--no-build");
  expect(s).not.toContain("compose build");
  const local = deployScript(
    prod,
    infra,
    {},
    select(infra, "all"),
    "origin/main",
    true,
    prod,
  );
  expect(local).toContain("compose build --pull");
});

import {
  candidates,
  parseProbe,
  rankHosts,
} from "../../packages/rg-config/infra.ts";

test("multi-candidate roles resolve statically to the first candidate", () => {
  expect(candidates(infra, "build")).toEqual(["vps", "cdn"]);
  expect(resolveHost(infra, "build").key).toBe("vps");
});

test("rankHosts prefers the least loaded live candidate and drops dead or full hosts", () => {
  const busy = [
    parseProbe("vps", "24.0 0.9 0.5"),
    parseProbe("cdn", "0.5 0.2 0.4"),
  ];
  expect(rankHosts(infra, "build", busy)).toEqual(["cdn", "vps"]);
  expect(
    rankHosts(infra, "build", [
      parseProbe("vps", null),
      parseProbe("cdn", "0.1 0.1 0.1"),
    ]),
  ).toEqual(["cdn"]);
  expect(
    rankHosts(infra, "build", [
      parseProbe("vps", "0 0 0.95"),
      parseProbe("cdn", "1 0.5 0.2"),
    ]),
  ).toEqual(["cdn"]);
  expect(
    rankHosts(
      infra,
      "build",
      [parseProbe("vps", "1 0.1 0.1"), parseProbe("cdn", "1 0.1 0.1")],
      ["sccache"],
    ),
  ).toEqual(["vps"]);
});

import {
  platformBlocker,
  platformCandidates,
  platformFor,
} from "../../packages/rg-config/platform.ts";

test("platformFor keeps a commercial SSR site off Vercel but allows Cloudflare", () => {
  const web = infra.services.services.website;
  const svc = { name: "website", ...web } as never;
  expect(platformCandidates(infra, svc)).toContain("cloudflare");
  expect(platformBlocker(infra, svc, "cloudflare")).toBeNull();
  // website is commercial; vercel forbids commercial, so it must not be chosen even if listed.
  expect(platformBlocker(infra, svc, "vercel")).toBe(
    "free tier is non-commercial only",
  );
  expect(platformFor(infra, svc).key).toBe("vps");
});

test("stateful and long-cpu services cannot move to the edge", () => {
  const pg = {
    name: "inagle-pg",
    ...infra.services.services["inagle-pg"],
  } as never;
  expect(platformBlocker(infra, pg, "cloudflare")).toContain("missing");
  const depot = {
    name: "steam-depot",
    ...infra.services.services["steam-depot"],
  } as never;
  expect(platformFor(infra, depot).key).toBe("vps");
});

test("RG_PLATFORM_<svc> override forces a platform", () => {
  const web = { name: "website", ...infra.services.services.website } as never;
  expect(
    platformFor(infra, web, { RG_PLATFORM_WEBSITE: "cloudflare" }).key,
  ).toBe("cloudflare");
});
