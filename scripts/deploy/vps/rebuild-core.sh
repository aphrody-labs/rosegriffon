set -e
cd /home/ubuntu/build/rg/repo && git fetch -q origin main && git reset -q --hard origin/main && git log --oneline -1
cd apps/rg-bot && bun run compile:core 2>&1 | tail -1
sudo -n install -m 755 dist/rg-core /usr/local/bin/rg-core.new && sudo -n mv /usr/local/bin/rg-core.new /usr/local/bin/rg-core
sudo -n systemctl restart rg-core; sleep 25; systemctl is-active rg-core
