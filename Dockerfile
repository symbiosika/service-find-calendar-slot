# use the official Bun image
# https://bun.sh/guides/ecosystem/docker

FROM oven/bun:1 as base
WORKDIR /usr/src/app

# Quick and dirty... we'll need to change this later
COPY . .
RUN bun install

EXPOSE 3000/tcp
ENTRYPOINT [ "bun", "run", "./src/index.ts" ]