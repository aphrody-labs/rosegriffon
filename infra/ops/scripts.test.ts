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
  expect(s).toContain(
    `ssh -n -o BatchMode=yes '${build.ssh}' "docker save $imgs" | docker load`,
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
