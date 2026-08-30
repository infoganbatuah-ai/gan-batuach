FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /gateway
ENV NODE_ENV=production
ENV PORT=8080

COPY server.mjs ./server.mjs

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["node", "server.mjs"]
