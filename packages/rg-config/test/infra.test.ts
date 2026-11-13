import { expect, test } from "bun:test";
import {
  composeEnv,
  domain,
  loadInfra,
  renderComposeEnv,
  renderTemplate,
  renderUpstreams,
  resolveHost,
  roles,
  service,
  services,
  vhost,
} from "../infra.ts";

const infra = loadInfra();

/** A role resolves to one host key, or to an ordered list of interchangeable ones. */
const firstHostOfRole = (role: string): string => {
  const v = infra.hosts.roles[role];
  if (!v) throw new Error(`role ${role} has no host`);
  return Array.isArray(v) ? v[0]! : v;
};

test("every role points at a declared host", () => {
  for (const role of roles(infra))
    expect(infra.hosts.hosts[firstHostOfRole(role)]).toBeDefined();
});

test("every service deploys to a known role", () => {
  for (const s of services(infra)) expect(roles(infra)).toContain(s.role);
});

test("RG_HOST_<ROLE> re-points a role, by key or ad hoc alias", () => {
  expect(resolveHost(infra, "prod", { RG_HOST_PROD: "vps" }).key).toBe("vps");
  const adhoc = resolveHost(infra, "prod", { RG_HOST_PROD: "newbox" });
  expect(adhoc.ssh).toBe("newbox");
  expect(adhoc.srv_root).not.toBe("");
});

test("RG_HOST_<KEY>_<FIELD> overrides one field", () => {
  const key = firstHostOfRole("prod");
  const h = resolveHost(infra, "prod", {
    [`RG_HOST_${key.toUpperCase()}_SRV_ROOT`]: "/data/rg",
  });
  expect(h.srv_root).toBe("/data/rg");
  expect(composeEnv(h, infra).RG_SRV_ROOT).toBe("/data/rg");
});

test("unknown role fails loudly", () => {
  expect(() => resolveHost(infra, "nope")).toThrow(/unknown role/);
  expect(() => service(infra, "nope")).toThrow(/unknown service/);
});

test("domain and vhosts honour RG_DOMAIN", () => {
  expect(vhost(infra, "@", { RG_DOMAIN: "example.test" })).toBe("example.test");
  expect(vhost(infra, "api", { RG_DOMAIN: "example.test" })).toBe(
    "api.example.test",
  );
  expect(domain(infra)).toBe(infra.services.site.domain);
});

test("upstreams are rendered from the registry", () => {
  const out = renderUpstreams(infra);
  for (const s of services(infra).filter((x) => x.upstream))
    expect(out).toContain(
      `upstream ${s.upstream!.name} {\n    zone ${s.upstream!.name} 64k;\n    server ${s.name}:${s.port} resolve;`,
    );
});

test("templates expand vhosts from the registry", () => {
  const out = renderTemplate(
    "a ${RG_VHOSTS:website:!www} b ${RG_VHOST:www} c ${RG_DOMAIN}",
    infra,
    { RG_DOMAIN: "example.test" },
  );
  expect(out).toBe(
    "a example.test achillea.example.test azalee.example.test shop.example.test b www.example.test c example.test",
  );
  expect(() => renderTemplate("${RG_VHOSTS:nope}", infra)).toThrow();
});

test("compose env file per host", () => {
  const prd = resolveHost(infra, "prod");
  expect(renderComposeEnv(prd, infra)).toContain(
    `RG_SRV_ROOT=${prd.srv_root}\n`,
  );
});
