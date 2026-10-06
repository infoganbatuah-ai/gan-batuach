#!/bin/zsh
set -euo pipefail

base="http://127.0.0.1:3002"
start_batch="${1:-06}"

run_batch() {
  local batch="$1"
  local env_name="$2"
  (( ${batch#0} < ${start_batch#0} )) && return 0
  print "[reference-reconstruction] UX-${batch} visual capture"
  env "${env_name}=${base}" npm run "qa:ux${batch}-visual"
}

run_batch 06 GB_UX06_BASE_URL
run_batch 07 GB_UX07_BASE_URL
run_batch 08 GB_UX08_BASE_URL
run_batch 09 GB_UX09_BASE_URL
run_batch 10 GB_UX10_BASE_URL
run_batch 11 GB_UX11_BASE_URL
run_batch 12 GB_UX12_BASE_URL
run_batch 13 GB_UX13_BASE_URL
run_batch 14 GB_UX14_BASE_URL
run_batch 15 GB_UX15_BASE_URL
run_batch 19 GB_UX19_BASE_URL
