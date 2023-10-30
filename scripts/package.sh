#!/usr/bin/env bash
set -eo pipefail

apt update && apt install -y zip

declare -a platforms=("win" "mac" "linux" "linux-armv7l" "linux-arm64")
declare -a build_dirs=("build/win-unpacked" "build/mac/webapp-display.app" "build/linux-unpacked" "build/linux-armv7l-unpacked" "build/linux-arm64-unpacked")
PROJECT_DIR=$PWD
ARTIFACTS_DIR="${PROJECT_DIR}/artifacts"
mkdir "${ARTIFACTS_DIR}"


for (( i=0; i<${#platforms[@]}; i++ ));
do
  echo "Packaging for ${platforms[$i]} platform"
  cd "${build_dirs[$i]}"
  echo {\"version\": \"$COMMIT_TAG\", \"commit\": \"$COMMIT_HASH\", \"buildJob\": $CI_JOB_ID} > build.json
  if [ ${platforms[$i]} = "win" ]; then
    zip -r -9 $ARTIFACTS_DIR/${REPOSITORY/$OWNER\//}-${platforms[$i]}-$COMMIT_TAG.zip *
  else
    tar czvf $ARTIFACTS_DIR/${REPOSITORY/$OWNER\//}-${platforms[$i]}-$COMMIT_TAG.tar.gz *
  fi
  cd $PROJECT_DIR
done
