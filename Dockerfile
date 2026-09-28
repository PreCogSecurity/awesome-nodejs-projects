# Verification image for the curated list.
#
# This image has one job: run `npm run verify` so the repository's own checks can
# be executed on a machine with no local Node.js install. It is deliberately not
# a general-purpose development image.

# Pinned to a major.minor tag and refreshed by the `docker` ecosystem in
# .github/dependabot.yml, rather than floating on `latest`.
FROM node:22-alpine

# Keep npm quiet and offline-friendly: no update notifier, no funding prompt,
# no telemetry in build logs. CI cache lands in /tmp, which is a tmpfs at runtime.
ENV NODE_ENV=development \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_CACHE=/tmp/npm-cache

WORKDIR /app

# Install from the committed lockfile only, and never run package lifecycle
# scripts. `--ignore-scripts` removes arbitrary code execution at image build
# time; the repository currently has zero dependencies so this is a no-op that
# stays correct if that ever changes.
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

# Copy only what `npm run verify` needs. A blanket `COPY . .` would bake the
# entire `.git` directory - and therefore the full history, any credentials ever
# committed and then removed, and contributor metadata - into a published image.
# .dockerignore is the second line of defence behind this allowlist.
COPY lint.config.mjs README.md ./
COPY data ./data
COPY src ./src
COPY test ./test

# Drop root. The `node` user ships in the base image as uid/gid 1000 and owns
# nothing above, so the container cannot write to the image layer at runtime.
USER node

CMD ["npm", "run", "verify"]
