#!/usr/bin/env sh
set -eo pipefail

docker run --rm -v $PWD:/project electronuserland/builder:18-wine scripts/build.sh
docker run -v $PWD:/app --workdir /app -e COMMIT_TAG -e COMMIT_HASH -e CI_JOB_ID -e REPOSITORY -e OWNER debian:bookworm-slim scripts/package.sh
