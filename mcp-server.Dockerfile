FROM node:24-bookworm AS deps

WORKDIR /app

# Only the manifests needed to build @actual-app/mcp-server and the API it
# wraps, so unrelated workspace changes don't invalidate the install layer.
COPY .yarn ./.yarn
COPY yarn.lock package.json .yarnrc.yml tsconfig.json lage.config.js ./
COPY packages/api/package.json packages/api/package.json
COPY packages/crdt/package.json packages/crdt/package.json
COPY packages/loot-core/package.json packages/loot-core/package.json
COPY packages/vite-plugin-peggy/package.json packages/vite-plugin-peggy/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json

RUN yarn install

FROM deps AS builder

WORKDIR /app

COPY packages/ ./packages/

ENV NODE_OPTIONS=--max_old_space_size=8192

# lage's task hasher needs a git repo; .dockerignore omits the real .git.
RUN git -c init.defaultBranch=master init -q \
    && git -c user.email=build@docker -c user.name=docker-build add -A \
    && git -c user.email=build@docker -c user.name=docker-build commit -qm build

RUN yarn build --scope=@actual-app/mcp-server

RUN yarn workspaces focus @actual-app/mcp-server --production

FROM node:24-bookworm-slim AS prod

RUN apt-get update && apt-get install -y tini && apt-get clean -y && rm -rf /var/lib/apt/lists/*

ARG USERNAME=actual
ARG USER_UID=1001
ARG USER_GID=$USER_UID
RUN groupadd --gid $USER_GID $USERNAME \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME \
    && mkdir /data && chown -R ${USERNAME}:${USERNAME} /data

WORKDIR /app
ENV NODE_ENV=production
ENV MCP_DATA_DIR=/data

# node_modules/@actual-app/api is a workspace symlink into packages/api, so the
# API's built output has to sit at the same relative path.
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/packages/api/package.json ./packages/api/package.json
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/mcp-server/package.json ./packages/mcp-server/package.json
COPY --from=builder /app/packages/mcp-server/dist ./packages/mcp-server/dist

WORKDIR /app/packages/mcp-server
ENTRYPOINT ["/usr/bin/tini", "-g", "--"]
EXPOSE 5007
CMD ["node", "dist/index.js"]
