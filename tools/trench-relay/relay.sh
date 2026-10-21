#!/bin/sh
# TRENCHING SIMULATOR's Live mode relay on the owner's server (2026-10-21, #404): the relay (its own Docker image) and
# Caddy (HTTPS for live.agi1.app) beside her live show, each a one-line command. The settings (the Helius key) live in
# /opt/agi1-trench/trench.env, never in the site's folder or git. Both start again by themselves after a reboot.
#
#   sh tools/trench-relay/relay.sh update     get the newest code (git pull), rebuild the relay's image, start it again
#   sh tools/trench-relay/relay.sh start      start (or start again) the relay and Caddy
#   sh tools/trench-relay/relay.sh stop       stop both (the site then says the live feed isn't reachable)
#   sh tools/trench-relay/relay.sh check      its settings, both containers, and its health here and at https://live.agi1.app
#   sh tools/trench-relay/relay.sh logs       the relay's last 100 lines (logs 300: more; logs caddy: Caddy's)
#   sh tools/trench-relay/relay.sh status     what's running
set -eu
SITE=$(cd "$(dirname "$0")/../.." && pwd)
HERE="$SITE/tools/trench-relay"
DIR=${AGI1_TRENCH_DIR:-/opt/agi1-trench}
NET=agi1-trench-net
IMAGE=agi1-trench
CADDY_IMAGE=caddy:2.10
DOMAIN=live.agi1.app

health() {
  # the relay's own /health from inside its container (its port is never open to the internet): a few words of it
  docker exec agi1-trench node -e "
fetch('http://127.0.0.1:8787/health').then((r) => r.json()).then((h) => {
  const c = Object.entries(h.chains || {}).map(([k, v]) => k + ' ' + v.s + ' (' + v.coins + ' coins, ' + v.tracked + ' live)').join(' · ');
  console.log('ok   relay up ' + h.up + ' s · ' + h.clients + ' viewers · ' + c);
  if (h.solana) console.log('     Solana: PumpPortal ' + (h.solana.pumpportal ? (h.solana.pumpportal.connected ? 'connected' : 'NOT connected') : 'off') + ' · PumpDev ' + (h.solana.pumpdev && h.solana.pumpdev.running ? 'running (backup)' : 'idle') + ' · Helius ' + (h.solana.helius ? (h.solana.helius.connected ? 'connected, ' + h.solana.helius.live + ' curves live' : 'NOT connected') : 'no key'));
  console.log('     pictures ' + h.pictures.made + ' made, ' + h.pictures.failed + ' not shown · SOL ' + (h.prices ? '\$' + h.prices.sol : 'no price yet'));
  for (const p of h.problems || []) console.log('NO   ' + p);
}).catch((e) => { console.log('NO   the relay doesn\'t answer inside its container (' + e.message + ')'); process.exit(1); });
"
}

case "${1:-}" in
  update)
    git -C "$SITE" pull --ff-only
    docker build -t "$IMAGE" "$HERE"
    exec sh "$HERE/relay.sh" start
    ;;
  start)
    if [ ! -f "$DIR/trench.env" ]; then
      echo "no $DIR/trench.env yet: mkdir -p $DIR && cp $HERE/trench.env.example $DIR/trench.env && chmod 600 $DIR/trench.env, then the Helius key"
      exit 1
    fi
    if ! docker image inspect "$IMAGE" >/dev/null 2>&1; then
      echo "the relay's image isn't built yet: sh $HERE/relay.sh update"
      exit 1
    fi
    chmod 600 "$DIR/trench.env"
    docker network inspect "$NET" >/dev/null 2>&1 || docker network create "$NET" >/dev/null
    # the relay: its port only on Docker's own network (Caddy reaches it there); at most 3/4 of a core and 512 MB, so her
    # live show on the same server always has room
    docker rm -f agi1-trench >/dev/null 2>&1 || true
    docker run -d --name agi1-trench --restart unless-stopped --network "$NET" \
      --env-file "$DIR/trench.env" -e TRENCH_PORT=8787 -e TRENCH_HOST=0.0.0.0 \
      --cpus 0.75 --memory 512m --log-opt max-size=10m --log-opt max-file=3 \
      "$IMAGE" >/dev/null
    # Caddy: ports 80 and 443 (its certificate for live.agi1.app, kept in its own volume across restarts)
    docker rm -f agi1-trench-caddy >/dev/null 2>&1 || true
    docker run -d --name agi1-trench-caddy --restart unless-stopped --network "$NET" \
      -p 80:80 -p 443:443 -p 443:443/udp \
      -v "$HERE:/etc/agi1-trench:ro" -v agi1-trench-caddy-data:/data -v agi1-trench-caddy-config:/config \
      --log-opt max-size=10m --log-opt max-file=3 \
      "$CADDY_IMAGE" caddy run --config /etc/agi1-trench/Caddyfile --adapter caddyfile >/dev/null
    echo "started: the relay (agi1-trench) and Caddy (agi1-trench-caddy) for https://$DOMAIN"
    echo "in a minute: sh $HERE/relay.sh check"
    ;;
  stop)
    docker rm -f agi1-trench agi1-trench-caddy >/dev/null 2>&1 || true
    echo "stopped (the game says the live feed isn't reachable, and plays simulated coins)"
    ;;
  check)
    if [ -f "$DIR/trench.env" ]; then
      echo "ok   $DIR/trench.env ($(stat -c %a "$DIR/trench.env"))"
      if grep -q '^HELIUS_API_KEY=.\+' "$DIR/trench.env"; then echo "ok   HELIUS_API_KEY is set (never shown)"; else echo "NO   HELIUS_API_KEY is empty: Solana stays off"; fi
    else
      echo "NO   no $DIR/trench.env"
    fi
    for c in agi1-trench agi1-trench-caddy; do
      if [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null || true)" = "true" ]; then echo "ok   $c running"; else echo "NO   $c isn't running (sh $HERE/relay.sh start)"; fi
    done
    health || true
    if curl -fsS --max-time 10 "https://$DOMAIN/health" >/dev/null 2>&1; then
      echo "ok   https://$DOMAIN/health answers (the certificate works)"
    else
      echo "NO   https://$DOMAIN/health doesn't answer yet: the DNS record (live → this server), ports 80 and 443, or Caddy's certificate (sh $HERE/relay.sh logs caddy)"
    fi
    ;;
  logs)
    if [ "${2:-}" = "caddy" ]; then exec docker logs --tail "${3:-100}" agi1-trench-caddy; fi
    exec docker logs --tail "${2:-100}" agi1-trench
    ;;
  status)
    exec docker ps --filter name=agi1-trench --format '{{.Names}}  {{.Status}}  {{.Ports}}'
    ;;
  *)
    echo "sh tools/trench-relay/relay.sh update | start | stop | check | logs | status"
    exit 1
    ;;
esac
