FROM node:22-alpine

ARG BUILD_VERSION="dev"
ARG BUILD_ARCH="aarch64"

LABEL \
  io.hass.version="${BUILD_VERSION}" \
  io.hass.type="app" \
  io.hass.arch="${BUILD_ARCH}" \
  org.opencontainers.image.title="HeyHey Home Assistant Relay" \
  org.opencontainers.image.description="Restricted Home Assistant relay for HeyHeyPa" \
  org.opencontainers.image.source="https://github.com/derekfidler/heyhey-home-assistant-relay" \
  org.opencontainers.image.licenses="MIT"

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src

ENV PORT=8787 \
    CONFIG_PATH=/data/entities.yaml \
    OPTIONS_PATH=/data/options.json \
    HA_BASE_URL=http://supervisor/core/api

EXPOSE 8787
CMD ["node", "src/server.js"]
