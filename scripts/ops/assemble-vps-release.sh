#!/usr/bin/env bash
set -Eeuo pipefail

# Build exactly one immutable RG artifact. Activation is owned by aphrody-infra.
commit_arg="${1:?usage: assemble-vps-release.sh FULL_GIT_SHA}"
source_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
releases_root="${RG_RELEASES_ROOT:-/srv/rg/releases}"
catalog="${RG_CATALOG_PATH:-/usr/local/share/aphrody-infra/service-catalog.json}"
website_env="${RG_WEBSITE_ENV_PATH:-/etc/rose-griffon/website.env}"
build_env="${RG_BUILD_ENV:-/home/ubuntu/.rg-deploy-stage/root.env}"
node_image="node:22-bookworm-slim"
umask 027

[[ "$commit_arg" =~ ^[0-9a-f]{40}$ ]] || { echo 'full Git SHA required' >&2; exit 2; }
[[ -r "$catalog" ]] || { echo 'installed infra service catalog missing' >&2; exit 2; }
[[ -f "$website_env" && "$(stat -c %a "$website_env")" = 600 ]] || {
  echo 'website build environment must exist with mode 0600' >&2; exit 2;
}
[[ -f "$build_env" && "$(stat -c %a "$build_env")" = 600 ]] || {
  echo 'private Bun install environment must exist with mode 0600' >&2; exit 2;
}
for env_file in \
  /etc/rose-griffon/{website,rg-api,rg-cdn,rg-bot,rg-achillea-bot,rg-cron}.env \
  /etc/rg-storage.env /etc/rg-realtime.env; do
  [[ -f "$env_file" && "$(stat -c %a "$env_file")" = 600 ]] || {
    echo "required 0600 runtime environment missing: $env_file" >&2; exit 2;
  }
done
for runtime_dir in /var/www/cdn/static/rg/public /var/lib/rg; do
  [[ -d "$runtime_dir" ]] || { echo "required RG runtime directory missing: $runtime_dir" >&2; exit 2; }
done
cd "$source_root"
commit="$(git rev-parse --verify HEAD^{commit})"
[[ "$commit" = "$commit_arg" ]] || { echo 'checkout HEAD differs from requested commit' >&2; exit 2; }
git diff --quiet && git diff --cached --quiet || { echo 'tracked checkout changes must be committed first' >&2; exit 2; }
git cat-file -e "$commit:infra/nginx/rg-production.conf" || {
  echo 'rg-production.conf absent from requested commit' >&2; exit 2;
}
git cat-file -e "$commit:bun.lock" || { echo 'bun.lock absent from requested commit' >&2; exit 2; }
[[ "$(realpath -m -- "$releases_root")" = /srv/rg/releases ]] || {
  echo 'release root must be /srv/rg/releases' >&2; exit 2;
}
install -d -m 0755 "$releases_root"
install -d -m 0750 /srv/rg/shared/{website/cache,bot,cron}
destination="$releases_root/$commit"
[[ ! -e "$destination" ]] || { echo 'release already exists; refusing to overwrite' >&2; exit 2; }
stage="$(mktemp -d "$releases_root/.assembling-$commit.XXXXXX")"
cleanup() {
  if [[ -n "${stage:-}" && -d "$stage" && "$stage" = "$releases_root/.assembling-$commit."* ]]; then
    rm -rf -- "$stage"
  fi
}
trap cleanup EXIT

git archive --format=tar "$commit" | tar -xf - -C "$stage"
python3 - "$stage" <<'PY'
import pathlib
import sys
for path in pathlib.Path(sys.argv[1]).rglob('*'):
    if not path.is_file():
        continue
    name = path.name
    if name.endswith(('.pem', '.p12', '.pfx')) or (
        name.startswith('.env') and not name.endswith(('.example', '.sample', '.template'))
    ):
        raise SystemExit('release source contains a secret-like file')
PY
cd "$stage"
NODE_AUTH_TOKEN="$(python3 - "$build_env" <<'PY'
import pathlib
import shlex
import sys
for line in pathlib.Path(sys.argv[1]).read_text().splitlines():
    if not line.startswith('NODE_AUTH_TOKEN='):
        continue
    parts = shlex.split(line.split('=', 1)[1], comments=False, posix=True)
    if len(parts) != 1 or not parts[0]:
        raise SystemExit('NODE_AUTH_TOKEN is empty or invalid')
    print(parts[0], end='')
    break
else:
    raise SystemExit('NODE_AUTH_TOKEN is missing')
PY
)" || exit 2
export NODE_AUTH_TOKEN
bun install --frozen-lockfile
unset NODE_AUTH_TOKEN

# These workspace packages export dist/ files, which are absent from git.
# Build them before Next resolves their package exports.
(cd "$stage/packages/inagle" && bun run build)
(cd "$stage/packages/patreon-bun" && bun run build)

# Next 16 standalone must be built under Node 22; Bun is used for installs and
# for the final runtime. Docker reads the protected env file on the host only.
docker_cmd=(docker)
if [[ ! -r "$website_env" ]]; then docker_cmd=(sudo -n docker); fi
"${docker_cmd[@]}" image inspect "$node_image" >/dev/null
mkdir -p "$stage/.build-tmp" "$stage/.build-home"
docker_env="$stage/.docker-build.env"
python_cmd=(python3)
if [[ ! -r "$website_env" ]]; then python_cmd=(sudo -n python3); fi
"${python_cmd[@]}" - "$website_env" "$docker_env" <<'PY'
import os
import pathlib
import re
import shlex
import sys

source = pathlib.Path(sys.argv[1])
target = pathlib.Path(sys.argv[2])
lines = []
seen = set()
for raw in source.read_text().splitlines():
    stripped = raw.strip()
    if not stripped or stripped.startswith('#'):
        continue
    if stripped.startswith('export '):
        stripped = stripped.removeprefix('export ').lstrip()
    if '=' not in stripped:
        raise SystemExit('invalid website environment assignment')
    key, value = stripped.split('=', 1)
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key) or key in seen:
        raise SystemExit('invalid or duplicate website environment key')
    seen.add(key)
    # JSON credentials can be unquoted and contain spaces; Docker accepts the
    # entire text after '=' as one value. Decode only quoted dotenv values.
    if value.startswith(('"{', "'{")) and value.endswith(value[0]):
        # Legacy service-account JSON contains unescaped interior quotes.
        parts = [value[1:-1]]
    else:
        parts = shlex.split(value, comments=False, posix=True) if value.startswith(('"', "'")) else [value]
    if len(parts) != 1 or '\n' in parts[0] or '\r' in parts[0]:
        raise SystemExit('invalid website environment value')
    lines.append(f'{key}={parts[0]}\n')
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as output:
    output.writelines(lines)
PY
"${docker_cmd[@]}" run --rm --network host \
  --user "$(id -u):$(id -g)" \
  --env-file "$docker_env" \
  -e NEXT_TELEMETRY_DISABLED=1 -e SENTRY_SKIP_UPLOAD=1 \
  -e NODE_OPTIONS=--max-old-space-size=8192 \
  -e HOME=/work/.build-home -e TMPDIR=/work/.build-tmp \
  -v "$stage:/work" -w /work/apps/website \
  "$node_image" node node_modules/next/dist/bin/next build --turbopack
rm -f -- "$docker_env"
server="$stage/apps/website/.next/standalone/apps/website/server.js"
[[ -s "$stage/apps/website/.next/BUILD_ID" && -s "$server" ]] || {
  echo 'Next standalone build incomplete' >&2; exit 1;
}
install -m 0644 "$server" "$stage/apps/website/server.js"
rm -rf -- "$stage/apps/website/.next/standalone" "$stage/.build-tmp" "$stage/.build-home"

(cd "$stage/apps/achillea-bot" && bun run build)
[[ -s "$stage/apps/achillea-bot/build/main.js" && -s "$stage/apps/achillea-bot/build/ranked/main.js" ]] || {
  echo 'Achillea bot build incomplete' >&2; exit 1;
}
mkdir -p "$stage/apps/achillea-bot/logs" "$stage/apps/achillea-bot/storage"

mkdir -p "$stage/systemd" "$stage/nginx"
install -m 0644 "$stage/infra/nginx/rg-production.conf" "$stage/nginx/rg.conf"
python3 - "$stage" "$catalog" "$commit" <<'PY'
import datetime
import hashlib
import json
import pathlib
import re
import sys

root = pathlib.Path(sys.argv[1]).resolve()
catalog = json.loads(pathlib.Path(sys.argv[2]).read_text())
commit = sys.argv[3]
templates = {
    'rg-website': 'website-web.service',
    'rg-api': 'rg-api.service',
    'rg-cdn': 'rg-cdn.service',
    'rg-realtime': 'rg-realtime.service',
    'rg-storage': 'rg-storage.service',
    'rg-postgrest': 'rg-postgrest.service',
    'rg-bot': 'rg-bot.service',
    'rg-achillea-bot': 'achillea-bot.service',
    'rg-cron': 'rg-cron.service',
}
services = [service for service in catalog['services'] if service['id'].startswith('rg-')]
for service in services:
    name = service['id']
    if name not in templates or service['unit'] != f'{name}.service':
        raise SystemExit(f'no audited release unit mapping for {name}')
    source = root / 'infra' / 'systemd' / templates[name]
    text = source.read_text()
    if name == 'rg-website':
        text = text.replace('/home/ubuntu/rg-releases/website/slot-a', '/srv/rg/current')
        text = text.replace('/home/ubuntu/rg-releases/website', '/srv/rg/shared/website')
        text = text.replace('/home/ubuntu/rg/apps/website/.env', '/etc/rose-griffon/website.env')
        text = text.replace('[Install]',
            'BindPaths=/srv/rg/shared/website/cache:/srv/rg/current/apps/website/.next/cache\n\n[Install]')
    elif name == 'rg-achillea-bot':
        text = text.replace('/etc/rose-griffon/achillea.env', '/etc/rose-griffon/rg-achillea-bot.env')
        text = text.replace('ProtectSystem=full', 'ProtectSystem=strict')
        text = text.replace('[Install]',
            'ReadWritePaths=/srv/rg/shared/achillea\n'
            'BindPaths=/srv/rg/shared/achillea/logs:/srv/rg/current/apps/achillea-bot/logs\n'
            'BindPaths=/srv/rg/shared/achillea/storage:/srv/rg/current/apps/achillea-bot/storage\n\n[Install]')
    else:
        text = text.replace('/home/ubuntu/rg/apps/cdn/.env', '/etc/rose-griffon/rg-cdn.env')
        text = text.replace('/home/ubuntu/rg/apps/bot/.env', '/etc/rose-griffon/rg-bot.env')
        text = text.replace('/home/ubuntu/rg/.env.local', f'/etc/rose-griffon/{name}.env')
    if name == 'rg-bot':
        text = text.replace('ReadWritePaths=/home/ubuntu/rg/apps/bot /tmp',
                            'ReadWritePaths=/srv/rg/shared/bot /tmp')
    if name == 'rg-cron':
        text = text.replace('ReadWritePaths=/home/ubuntu/rg /home/ubuntu/niers/var ',
                            'ReadWritePaths=/srv/rg/shared/cron ')
        text = re.sub(r'(?m)^# `/home/ubuntu/niers/var`[^\n]*\n(?:^#[^\n]*\n)*', '', text)
    text = text.replace('/home/ubuntu/rg', '/srv/rg/current')
    seen_env = set()
    lines = []
    for line in text.splitlines(keepends=True):
        if line.startswith('EnvironmentFile='):
            line = line.replace('EnvironmentFile=-', 'EnvironmentFile=', 1)
            key = line.split('=', 1)[1]
            if key in seen_env:
                continue
            seen_env.add(key)
        lines.append(line)
    text = ''.join(lines)
    if '/home/ubuntu/rg' in text:
        raise SystemExit(f'legacy checkout path remains in {name}')
    output = root / 'systemd' / service['unit']
    output.write_text(text)

manifest = {
    'schemaVersion': 1,
    'repository': 'rg',
    'commit': commit,
    'builtAt': datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z'),
    'services': [service['id'] for service in services],
}
(root / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n')
(root / 'RELEASE_SHA').write_text(commit + '\n')

entries = []
for path in sorted(root.rglob('*')):
    if path.name == 'SHA256SUMS':
        continue
    if path.is_symlink() and not path.resolve(strict=True).is_relative_to(root):
        raise SystemExit('release symlink escapes artifact')
    if not path.is_file():
        continue
    relative = path.relative_to(root).as_posix()
    if '\n' in relative or '\\' in relative:
        raise SystemExit('unsupported filename in release')
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    entries.append(f'{digest.hexdigest()}  {relative}\n')
(root / 'SHA256SUMS').write_text(''.join(entries))
PY

sha256sum --quiet --check "$stage/SHA256SUMS"
mv -T -- "$stage" "$destination"
stage=""
printf 'assembled %s\n' "$destination"
