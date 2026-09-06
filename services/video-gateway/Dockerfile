FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /opt/observer-connector
ENV NODE_ENV=production
ENV OBSERVER_EDGE_DEVICE_TYPE=SOFTWARE_CONNECTOR
ENV OBSERVER_CONNECTOR_DATA_DIR=/var/lib/observer-connector
ENV OBSERVER_CONNECTOR_SECRET_DIR=/var/lib/observer-connector/secrets
ENV GAN_BATUACH_GATEWAY_SECRET_DIR=/var/lib/observer-connector/secrets
ENV PORT=18082

COPY --chown=node:node services/video-gateway ./services/video-gateway
COPY --chown=node:node scripts/run-persistent-home-gateway.mjs scripts/run-software-connector.mjs scripts/install-software-connector.mjs ./scripts/
RUN mkdir -p /var/lib/observer-connector/secrets && chown -R node:node /var/lib/observer-connector && chmod 700 /var/lib/observer-connector /var/lib/observer-connector/secrets

USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD wget -qO- http://127.0.0.1:18082/health || exit 1
CMD ["node", "scripts/run-software-connector.mjs"]
