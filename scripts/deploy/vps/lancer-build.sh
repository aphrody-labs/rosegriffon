for p in $(pgrep -f "repo/node_modules/n"); do kill $p 2>/dev/null; done
sleep 2
rm -f /home/ubuntu/build/rg/repo/apps/rg-website/.next/lock
cd /home/ubuntu/build/rg/repo && git fetch -q origin main && git reset -q --hard origin/main && git log --oneline -1
setsid nohup /home/ubuntu/build/run-build.sh > /home/ubuntu/logs/rg-website-build.log 2>&1 < /dev/null &
sleep 1; echo lancé
