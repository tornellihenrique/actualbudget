FROM node:24-bookworm AS deps

# Install required packages
RUN apt-get update && apt-get install -y openssl

WORKDIR /app

# Copy only the files needed for installing dependencies
COPY .yarn ./.yarn
COPY yarn.lock package.json .yarnrc.yml tsconfig.json lage.config.js ./
COPY packages/api/package.json packages/api/package.json
COPY packages/component-library/package.json packages/component-library/package.json
COPY packages/crdt/package.json packages/crdt/package.json
COPY packages/desktop-client/package.json packages/desktop-client/package.json
COPY packages/desktop-electron/package.json packages/desktop-electron/package.json
COPY packages/eslint-plugin-actual/package.json packages/eslint-plugin-actual/package.json
COPY packages/loot-core/package.json packages/loot-core/package.json
COPY packages/sync-server/package.json packages/sync-server/package.json
COPY packages/plugins-service/package.json packages/plugins-service/package.json
COPY packages/vite-plugin-peggy/package.json packages/vite-plugin-peggy/package.json

COPY ./bin/package-browser ./bin/package-browser

RUN yarn install

FROM deps AS builder

WORKDIR /app

COPY packages/ ./packages/

# Increase memory limit for the build process to 8GB
ENV NODE_OPTIONS=--max_old_space_size=8192

# lage's task hasher invokes `git ls-tree HEAD` during initialization, so it
# needs a git repo even when individual targets disable caching. .dockerignore
# omits the real .git, so seed a throwaway repo with a single commit here.
RUN git -c init.defaultBranch=master init -q \
    && git -c user.email=build@docker -c user.name=docker-build add -A \
    && git -c user.email=build@docker -c user.name=docker-build commit -qm build

# Stamps the build identity (commit SHA, build number) into the version the
# client reports. Declared here so changing it doesn't invalidate the dep layers.
# Railway injects RAILWAY_GIT_COMMIT_SHA into builds and deployments, but it is
# deploy-scoped: it never appears in the service's variable set, so referencing
# it as ${{ RAILWAY_GIT_COMMIT_SHA }} yields an empty string. It has to be read
# directly, as below. Empty when the deploy didn't originate from a git trigger.
ARG ACTUAL_BUILD_METADATA
ARG RAILWAY_GIT_COMMIT_SHA
ENV REACT_APP_BUILD_METADATA=${ACTUAL_BUILD_METADATA:-$RAILWAY_GIT_COMMIT_SHA}

RUN echo "Client build metadata: ${REACT_APP_BUILD_METADATA:-(none)}"

RUN yarn build:server

# Focus the workspaces in production mode (including @actual-app/web you just built)
RUN yarn workspaces focus @actual-app/sync-server --production

# Remove symbolic links for @actual-app/web and @actual-app/sync-server
RUN rm -rf ./node_modules/@actual-app/web ./node_modules/@actual-app/sync-server

# Copy in the @actual-app/web artifacts manually, so we don't need the entire packages folder
COPY ./packages/desktop-client/package.json ./node_modules/@actual-app/web/package.json
RUN cp -r ./packages/desktop-client/build ./node_modules/@actual-app/web/build

FROM node:24-bookworm-slim AS prod

# Minimal runtime dependencies
RUN apt-get update && apt-get install -y tini && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Create a non-root user
ARG USERNAME=actual
ARG USER_UID=1001
ARG USER_GID=$USER_UID
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && mkdir /data && chown -R ${USERNAME}:${USERNAME} /data

WORKDIR /app
ENV NODE_ENV=production

# Same identity the client was built with, read at runtime by /info. A runtime
# environment variable of the same name overrides this.
ARG ACTUAL_BUILD_METADATA
ARG RAILWAY_GIT_COMMIT_SHA
ENV ACTUAL_BUILD_METADATA=${ACTUAL_BUILD_METADATA:-$RAILWAY_GIT_COMMIT_SHA}

# Pull in only the necessary artifacts (built node_modules, server files, etc.)
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/sync-server/package.json ./
COPY --from=builder /app/packages/sync-server/build ./build

ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
EXPOSE 5006
# Resolved at start rather than baked in, so the commit is picked up even when
# the platform only exposes it to the running container and not to the build.
CMD ["sh", "-c", "export ACTUAL_BUILD_METADATA=\"${ACTUAL_BUILD_METADATA:-$RAILWAY_GIT_COMMIT_SHA}\"; exec node build/app.js"]
