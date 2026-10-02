#!/bin/sh
# AGI-1's live show on the owner's server (2026-10-02): runs her Docker image with the server's settings, so every command
# is one short line. See "Her live show on X" in CLAUDE.md. The settings and Google's key file live in /opt/agi1-live/
# (live.env, google-key.json), never in the site's folder or git.
#
#   sh tools/live/live.sh update              get the newest code (git pull) and rebuild her image: after every push
#   sh tools/live/live.sh --check             checks the settings, agi1.app and her voice (listen: /opt/agi1-live/out)
#   sh tools/live/live.sh --record try.mp4 --minutes 5
#                                             a real show into a file instead of X (/opt/agi1-live/out/try.mp4)
#   sh tools/live/live.sh --sync-check        her mouth vs her voice on this server (then LIVE_AV_MS in live.env)
#   sh tools/live/live.sh --warm              makes all her pre-written lines' voices once (at setup: about 10 minutes)
#   sh tools/live/live.sh --owner-link        the owner's phone link (agi1.app/live#admin=…)
#   sh tools/live/live.sh --announce 20:00    tells agi1.app/live when her next show is (UTC)
#   sh tools/live/live.sh show                today's show: "starting soon" until LIVE_DAILY_AT, then the show (the cron line)
# Anything else is passed to tools/live/run.mjs as it is. Run checks when no show is on (they share the processor).
set -eu
SITE=$(cd "$(dirname "$0")/../.." && pwd)
DIR=${AGI1_LIVE_DIR:-/opt/agi1-live}

if [ "${1:-}" = "update" ]; then
  git -C "$SITE" pull --ff-only
  exec docker build -f "$SITE/tools/live/Dockerfile" -t agi1-live "$SITE"
fi

if [ ! -f "$DIR/live.env" ]; then
  echo "no $DIR/live.env yet: mkdir -p $DIR && cp $SITE/tools/live/live.env.example $DIR/live.env, then fill it in (nano $DIR/live.env)"
  exit 1
fi

# today's show: its start time from live.env (LIVE_DAILY_AT, UTC)
if [ "${1:-}" = "show" ]; then
  shift
  AT=$(sed -n 's/^LIVE_DAILY_AT=//p' "$DIR/live.env" | tail -n 1 | tr -d ' \r"')
  set -- --start-at "${AT:-20:00}" "$@"
fi

if ! docker image inspect agi1-live >/dev/null 2>&1; then
  echo "her image isn't built yet: sh $SITE/tools/live/live.sh update"
  exit 1
fi
# the show runs as the image's own user (never root): it may write the folder for files the owner opens, and read
# Google's key file (nobody else on the server can)
SHOW_USER=$(docker run --rm --entrypoint id agi1-live -u)
mkdir -p "$DIR/out"
chown "$SHOW_USER" "$DIR/out"
KEY=""
if [ -f "$DIR/google-key.json" ]; then
  chown "$SHOW_USER" "$DIR/google-key.json"
  chmod 600 "$DIR/google-key.json"
  KEY="-v $DIR/google-key.json:/secrets/google-key.json:ro"
fi

# shellcheck disable=SC2086
exec docker run --rm --init --shm-size=1g --stop-timeout 45 \
  --env-file "$DIR/live.env" $KEY \
  -v agi1-live-cache:/app/tools/live/cache \
  -v "$DIR/out:/out" \
  agi1-live "$@"
