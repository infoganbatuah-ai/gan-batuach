#!/usr/bin/env bash
set -euo pipefail

if [ -z "${LOCAL_DVR_ONBOARDING_TOKEN:-}" ]; then
  printf "Local DVR onboarding token: " >&2
  IFS= read -r -s LOCAL_DVR_ONBOARDING_TOKEN
  printf "\n" >&2
  export LOCAL_DVR_ONBOARDING_TOKEN
fi

if [ -z "${LOCAL_DVR_ONBOARDING_TOKEN}" ]; then
  echo "A local onboarding token is required." >&2
  exit 1
fi

export LOCAL_DVR_ONBOARDING_ENABLED=true
export VIDEO_GATEWAY_PROVIDER="${VIDEO_GATEWAY_PROVIDER:-custom}"

exec npm run dev
