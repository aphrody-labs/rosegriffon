// SPDX-License-Identifier: Apache-2.0
/**
 * Remote shell scripts for the uniform verbs (build, deploy, verify, rollback, migrate).
 * Pure builders: every host fact comes from a resolved {@link Host}, every service fact from
 * the registry, so no machine name, address or path is spelled here.
 */

import {
  type Host,
  type Infra,
  type InfraEnv,
  type Service,
  composeEnv,
  repoUrl,
  services as allServices,
  vhost,
} from "../../packages/rg-config/infra.ts";

const q = (s: string) => `'${s.replaceAll("'", `'\\''`)}'`;

/** Profiles to enable so `docker compose` sees the given services. */
function profileFlags(list: Service[]): string {
  const p = [
    ...new Set(list.map((s) => s.profile).filter(Boolean)),
  ] as string[];
  return p.map((x) => ` --profile ${x}`).join("");
}

function targetsOf(list: Service[]): string {
  return list.map((s) => s.name).join(" ");
}

/** Resolves "all" or a service name to the services acting in the default stack. */
export function select(infra: Infra, name: string): Service[] {
  const list = allServices(infra);
  if (name === "all" || name === "") return list.filter((s) => !s.profile);
  const s = list.find((x) => x.name === name);
  if (!s)
    throw new Error(
      `unknown service "${name}" (all, ${list.map((x) => x.name).join(", ")})`,
    );
  return [s];
}

/** Header shared by every script: strict mode, compose env, stack checkout at `ref`. */
export function prelude(
  host: Host,
  infra: Infra,
  env: InfraEnv,
  ref?: string,
): string {
  const vars = Object.entries(composeEnv(host, infra, env))
    .map(([k, v]) => `export ${k}=${q(v)}`)
    .join("\n");
  const checkout = ref
    ? [
        `[ -d "$RG_STACK_DIR/.git" ] || git clone --filter=blob:none ${q(repoUrl(infra, env))} "$RG_STACK_DIR"`,
        `git -C "$RG_STACK_DIR" fetch --quiet origin`,
        // The stack dir is a deploy checkout: local edits and generated leftovers never survive.
        `git -C "$RG_STACK_DIR" checkout --quiet --force --detach ${q(ref)}`,
        `git -C "$RG_STACK_DIR" clean -fdq`,
      ].join("\n")
    : "";
  return [
    "set -euo pipefail",
    vars,
    checkout,
    `cd "$RG_STACK_DIR"`,
    `export RG_TAG=\${RG_TAG:-$(git rev-parse --short HEAD)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildScript(
  host: Host,
  infra: Infra,
  env: InfraEnv,
  list: Service[],
  ref: string,
): string {
  return [
    prelude(host, infra, env, ref),
    // The website prerender reads the databases: a build env file next to the runtime one
    // (loopback URLs of the build host) switches the build to the host network.
    `b="\${RG_ENV_FILE%/*}/rosegriffon.build.env"; if [ -r "$b" ]; then export RG_BUILD_ENV_FILE="$b" RG_BUILD_NETWORK=host; fi`,
    `docker compose${profileFlags(list)} config -q`,
    `docker compose${profileFlags(list)} build --pull ${targetsOf(list)}`,
    `echo "built RG_TAG=$RG_TAG on $(hostname)"`,
  ].join("\n");
}

/**
 * Lines that copy the stack images (RG_TAG) built on `from` into the local Docker engine:
 * `docker save` over ssh piped into `docker load`, no registry. The deploy host reaches the
 * build host through its ssh alias (RG_SHIP_SSH overrides it).
 */
export function shipLines(
  from: Host,
  list: Service[],
  env: InfraEnv,
): string[] {
  // Only images built from the Dockerfile; upstream images are pulled by compose.
  const built = list.filter((s) => s.target && s.dockerfile);
  if (!built.length) return [];
  const ssh = env.RG_SHIP_SSH?.trim() || from.ssh;
  return [
    `imgs=$(docker compose${profileFlags(built)} config --images ${targetsOf(built)} | grep "^\${RG_REGISTRY:-rosegriffon}/" | sort -u | tr "\\n" " ")`,
    `echo "ship from ${from.key}: $imgs"`,
    `ssh -o BatchMode=yes ${q(ssh)} "docker save $imgs" | docker load`,
  ];
}

export function deployScript(
  host: Host,
  infra: Infra,
  env: InfraEnv,
  list: Service[],
  ref: string,
  all: boolean,
  /** Build host when it is not the deploy host: images are shipped instead of built here. */
  buildHost?: Host,
): string {
  const longRunning = list.filter((s) => s.profile !== "tools");
  const tools = list.filter((s) => s.profile === "tools");
  const ship = buildHost && buildHost.key !== host.key;
  const lines = [
    prelude(host, infra, env, ref),
    // Two rg-core processes would log the same Discord bots in twice and run cron twice.
    `if systemctl is-active --quiet rg-core 2>/dev/null; then echo "rg-core.service is active on $(hostname): cut over first"; exit 1; fi`,
    `docker compose${profileFlags(list)} config -q`,
    ...(ship
      ? shipLines(buildHost, list, env)
      : [
          `docker compose${profileFlags(list)} build --pull ${targetsOf(list)}`,
        ]),
  ];
  if (longRunning.length)
    lines.push(
      `docker compose${profileFlags(longRunning)} up -d --wait --wait-timeout 300${ship ? " --no-build" : ""} ${all ? "--remove-orphans" : targetsOf(longRunning)}`,
    );
  for (const t of tools)
    lines.push(
      `echo "${t.name}: image ready, run with: docker compose --profile tools run --rm ${t.name}"`,
    );
  lines.push(
    `docker compose ps`,
    `echo "deployed RG_TAG=$RG_TAG on $(hostname)"`,
  );
  return lines.join("\n");
}

/** Health of each service from inside the stack network, then its vhosts through the stack nginx. */
export function verifyScript(
  host: Host,
  infra: Infra,
  env: InfraEnv,
  list: Service[],
): string {
  const probes = list
    .filter((s) => s.port && s.health && s.profile !== "tools")
    .map((s) => `probe ${s.name} ${s.port} ${s.health}`);
  const names = list.flatMap((s) => s.vhosts.map((v) => vhost(infra, v, env)));
  const lines = [
    prelude(host, infra, env),
    `fail=0`,
    // Through the stack nginx when it runs on this host, else from inside the service itself.
    `probe() { if docker compose exec -T nginx wget -q -O /dev/null -T 10 "http://$1:$2$3" 2>/dev/null || docker compose exec -T "$1" wget -q -O /dev/null -T 10 "http://127.0.0.1:$2$3"; then echo "ok   $1:$2$3"; else echo "FAIL $1:$2$3"; fail=1; fi; }`,
    `docker compose ps`,
    ...probes,
  ];
  if (names.length)
    lines.push(
      `for h in ${names.join(" ")}; do`,
      `  curl -s -o /dev/null -w "stack  $h %{http_code}\\n" --max-time 10 -H "Host: $h" "http://127.0.0.1:\${RG_NGINX_PORT:-18080}/health"`,
      `  curl -s -o /dev/null -w "public $h %{http_code}\\n" --max-time 10 "https://$h/health"`,
      `done`,
    );
  lines.push(`exit $fail`);
  return lines.join("\n");
}

export function rollbackScript(
  host: Host,
  infra: Infra,
  env: InfraEnv,
  list: Service[],
  tag: string,
  all: boolean,
): string {
  return [
    prelude(host, infra, env),
    `RG_TAG=${q(tag)} docker compose${profileFlags(list)} up -d --wait --no-build ${all ? "" : targetsOf(list)}`.trimEnd(),
    `docker compose ps`,
  ].join("\n");
}

export function stopScript(
  host: Host,
  infra: Infra,
  env: InfraEnv,
  list: Service[],
): string {
  return [
    prelude(host, infra, env),
    `docker compose${profileFlags(list)} stop ${targetsOf(list)}`,
  ].join("\n");
}

/**
 * Runs on the source host: pushes each state dir (and the env file when the target lacks it)
 * to the target over ssh. The source must be able to reach the target (`to.user@address`).
 */
export function syncStateScript(from: Host, to: Host, svc: Service): string {
  const address = `${to.user ? `${to.user}@` : ""}${to.public_ip || to.ssh}`;
  const rsh = `ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new`;
  const lines = ["set -euo pipefail"];
  for (const dir of svc.state) {
    const src = `${from.srv_root}/${dir}/`;
    const dst = `${to.srv_root}/${dir}/`;
    lines.push(
      `if [ -d ${q(src)} ]; then`,
      `  ${rsh} ${address} mkdir -p ${q(dst)}`,
      `  rsync -aH --delete --info=stats1 -e ${q(rsh)} ${q(src)} ${address}:${q(dst)}`,
      `else echo "skip ${dir}: absent on $(hostname)"; fi`,
    );
  }
  lines.push(
    `if ! ${rsh} ${address} test -f ${q(to.env_file)}; then`,
    `  ${rsh} ${address} "mkdir -p \\"\\$(dirname ${q(to.env_file)})\\""`,
    `  rsync -a --chmod=F600 -e ${q(rsh)} ${q(from.env_file)} ${address}:${q(to.env_file)}`,
    `fi`,
  );
  return lines.join("\n");
}

export interface MigrateStep {
  title: string;
  host: Host;
  script: string;
}

/** Ordered plan moving one service (state + runtime) from one host to another. */
export function migratePlan(
  infra: Infra,
  env: InfraEnv,
  svc: Service,
  from: Host,
  to: Host,
  ref: string,
): MigrateStep[] {
  if (from.key === to.key && from.ssh === to.ssh)
    throw new Error(
      `migrate ${svc.name}: source and target are both ${from.key}`,
    );
  const list = [svc];
  return [
    {
      title: `prepare ${svc.name} on ${to.key} (checkout ${ref}, build)`,
      host: to,
      script: buildScript(to, infra, env, list, ref),
    },
    {
      title: `stop ${svc.name} on ${from.key}`,
      host: from,
      script: stopScript(from, infra, env, list),
    },
    {
      title: `sync state ${svc.state.join(", ") || "(none)"} ${from.key} -> ${to.key}`,
      host: from,
      script: syncStateScript(from, to, svc),
    },
    {
      title: `start ${svc.name} on ${to.key}`,
      host: to,
      script: deployScript(to, infra, env, list, ref, false),
    },
    {
      title: `verify ${svc.name} on ${to.key}`,
      host: to,
      script: verifyScript(to, infra, env, list),
    },
  ];
}
