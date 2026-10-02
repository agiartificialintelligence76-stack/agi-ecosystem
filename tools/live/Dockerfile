# AGI-1's live show (2026-10-02): the image her stream runs in, on the owner's own rented server (never on Vercel).
# Chromium (Playwright's own build), a virtual screen (Xvfb), ffmpeg, Node and the site's code (her 2D model, her rules).
# On the server, in the site's folder (a git clone of the repo), tools/live/live.sh does everything (see "Her live show on
# X" in CLAUDE.md):
#   sh tools/live/live.sh update      git pull, then: docker build -f tools/live/Dockerfile -t agi1-live .
#   sh tools/live/live.sh show        today's show, with /opt/agi1-live/live.env and Google's key file; what it runs:
#   docker run --rm --init --shm-size=1g --stop-timeout 45 --env-file /opt/agi1-live/live.env \
#     -v /opt/agi1-live/google-key.json:/secrets/google-key.json:ro -v agi1-live-cache:/app/tools/live/cache \
#     -v /opt/agi1-live/out:/out agi1-live --start-at 20:00
FROM mcr.microsoft.com/playwright:v1.63.0-noble

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg xvfb fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# the site's packages (three.js for her, Vite to build her set's page), and playwright-core (the same version as the image's
# Chromium; not one of the site's packages)
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund \
 && npm install --no-save --no-audit --no-fund playwright-core@1.63.0

COPY . .
RUN node tools/live/run.mjs --build \
 && mkdir -p tools/live/cache /out \
 && chown -R pwuser:pwuser tools/live/cache /out

# never root: the show runs as the image's own user
USER pwuser
ENV NODE_ENV=production
# files the owner opens (--check's live-check.wav, --record try.mp4): a folder on the server mounted here (-v …:/out)
ENV LIVE_OUT_DIR=/out
ENTRYPOINT ["node", "tools/live/run.mjs"]
