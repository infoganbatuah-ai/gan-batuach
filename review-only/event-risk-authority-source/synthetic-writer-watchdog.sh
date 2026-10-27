#!/bin/sh
# Disposable guest-only exact-ID watchdog. No source socket/path or broad rule.
set -eu
id_one="$1"
id_two="$2"
service="$3"
seconds="$4"
restored_service="$5"
deadline=$(( $(date +%s) + seconds ))
resumed=1
while [ "$(date +%s)" -lt "$deadline" ]; do
  if /usr/bin/docker info >/dev/null 2>&1; then
    if /usr/bin/docker unpause "$id_one" "$id_two" >/dev/null 2>&1; then
      resumed=0
      break
    fi
  fi
  sleep 1
done
for port in 18080 15432; do
  /usr/sbin/iptables -D INPUT -i lo -p tcp --dport "$port" -j REJECT >/dev/null 2>&1 || true
done
if ! /usr/bin/systemctl is-active --quiet "$service" && ! /usr/bin/systemctl is-active --quiet "$restored_service"; then
  /usr/bin/systemd-run --unit="${restored_service%.service}" --property=RuntimeMaxSec=60s \
    /usr/bin/python3 /tmp/synthetic-writer-server.py >/dev/null 2>&1 || true
fi
exit "$resumed"
