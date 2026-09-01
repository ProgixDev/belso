# The image the site runs as (spec 013).
#
# Three stages so the runtime carries none of the build: no pnpm, no lockfile,
# no source, no test suite. What ships is the traced server from
# `output: "standalone"` plus the static assets, which is the smallest thing
# that can serve this site.

# ---------------------------------------------------------------------------
# deps — resolve exactly what the lockfile says, and nothing else
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

# libc6-compat: `sharp` ships prebuilt binaries linked against glibc for some
# platforms, and Alpine is musl. Without this the media pipeline fails at
# runtime rather than at build, which is the worst place to find it — the
# catalogue serves fine and only uploading a photograph breaks.
RUN apk add --no-cache libc6-compat

WORKDIR /app
RUN corepack enable

# **`pnpm-workspace.yaml` is not optional here.** It carries `allowBuilds`, the
# opt-in list of dependencies permitted to run install scripts. Omit it and pnpm
# finds no allow-list, refuses to build `sharp` and `unrs-resolver`, and exits 1
# with ERR_PNPM_IGNORED_BUILDS — which reads exactly like a broken lockfile and
# is a missing file. That is how the first build of this image failed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --frozen-lockfile: build what was committed or fail. A container built from a
# tree nobody reviewed is not the tree that passed `pnpm verify`.
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# build — compile, with the public site URL baked in
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# **`NEXT_PUBLIC_SITE_URL` is inlined at build time, not read at runtime.**
# Setting it in the container's environment does nothing: the sitemap and the
# JSON-LD would keep claiming `localhost:3000` on the live site. So it arrives
# as a build argument, and changing the domain means rebuilding rather than
# restarting — which is why spec 013's T-16 says so explicitly.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}

# `next build` sets NODE_ENV=production itself, and `src/core/env.ts` skips its
# production guards during the build phase precisely so an image can be built
# without a database. That property is asserted by `env.test.ts`; this line
# depends on it.
RUN pnpm build

# ---------------------------------------------------------------------------
# runtime — the traced server, as a non-root user
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
# Next's standalone server reads these two rather than argv.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# `node` (uid 1000) already exists in the base image. Running as root would give
# a web server write access to its own code, and this one writes uploaded files
# to a mounted volume — the one directory it should be able to touch.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# Where uploaded photographs land. A volume is mounted here in compose; the
# directory is created and owned now so the container does not need to be root
# to write the first upload.
ENV MEDIA_ROOT=/app/media
RUN mkdir -p /app/media && chown node:node /app/media

USER node
EXPOSE 3000

# `/robots.txt` rather than `/`: it is static, needs no database, and answers
# even when the catalogue cannot be read. A health check that fails on a
# database outage would restart a container that is correctly serving the
# "listings cannot be loaded" page.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
