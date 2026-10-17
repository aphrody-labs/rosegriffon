set -e
cd /home/ubuntu/apps/rg
B=/home/ubuntu/build/rg/repo/apps/rg-website; S=$B/.next/standalone; N=/home/ubuntu/apps/rg/next-new
rm -rf $N; cp -a $S $N
mkdir -p $N/apps/rg-website/.next/cache; cp -a $B/.next/static $N/apps/rg-website/.next/static
[ -d $B/public ] && cp -a $B/public $N/apps/rg-website/public
sudo -n systemctl stop rg-website; mv current old-cur; mv next-new current; sudo -n systemctl start rg-website
sleep 8; systemctl is-active rg-website; curl -s -o /dev/null -w "%{http_code}\n" localhost:3100/
rm -rf old-cur; ls
