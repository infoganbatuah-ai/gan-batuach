#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to run the local Video Gateway." >&2
  exit 1
fi

if ! command -v ffprobe >/dev/null 2>&1; then
  echo "ffprobe is required for read-only DVR stream checks." >&2
  echo "Install ffmpeg first, then run this script again." >&2
  exit 1
fi

if [ -z "${VIDEO_GATEWAY_SIGNING_SECRET:-}" ] && [ -z "${VIDEO_GATEWAY_API_KEY:-}" ] && [ -z "${CAMERA_GATEWAY_SECRET:-}" ]; then
  printf "Video Gateway shared secret: " >&2
  IFS= read -r -s VIDEO_GATEWAY_SIGNING_SECRET
  printf "\n" >&2
  export VIDEO_GATEWAY_SIGNING_SECRET
fi

export HOST="${HOST:-127.0.0.1}"
export PORT="${PORT:-8080}"
export DVR_EXPECTED_CHANNEL_COUNT="${DVR_EXPECTED_CHANNEL_COUNT:-16}"

exec node services/video-gateway/server.mjs
