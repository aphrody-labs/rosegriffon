set -e
P=/home/ubuntu/.aphrody/private; mkdir -p $P; chmod 700 $P
[ -s $P/remote.token ] || (openssl rand -hex 24 > $P/remote.token)
[ -s $P/vnc.password ] || (openssl rand -hex 4 > $P/vnc.password)
chmod 600 $P/remote.token $P/vnc.password
pgrep -x Xvfb >/dev/null || setsid nohup Xvfb :99 -screen 0 1600x900x24 -nolisten tcp > /home/ubuntu/build/xvfb99.log 2>&1 < /dev/null &
sleep 2
pgrep -x openbox >/dev/null || DISPLAY=:99 setsid nohup openbox > /home/ubuntu/build/openbox.log 2>&1 < /dev/null &
sleep 1
if ! ss -ltn | grep -q ":8795 "; then
  DISPLAY=:99 APHRODY_REMOTE_TOKEN=$(cat $P/remote.token) APHRODY_VNC_PASSWORD=$(cat $P/vnc.password) setsid nohup /home/ubuntu/.local/bin/aphrody infra --root /home/ubuntu/.aphrody remote serve --bind 127.0.0.1:8795 --vnc 127.0.0.1:5900 > /home/ubuntu/build/remote.log 2>&1 < /dev/null &
fi
sleep 4
ss -ltn | grep -E ":(5900|8795) " | awk '{print $4}'
tail -3 /home/ubuntu/build/remote.log | cut -c1-160
