#!/bin/bash

set -eo pipefail

declare -a platforms=("win" "mac" "linux")
declare -a build_dirs=("build/win-unpacked" "build/mac/webapp-display.app" "build/linux-unpacked")
PROJECT_DIR=$PWD
ARTIFACTS_DIR="${PROJECT_DIR}/artifacts"
mkdir "${ARTIFACTS_DIR}"


for (( i=0; i<${#platforms[@]}; i++ ));
do
  echo "Packaging for ${platforms[$i]} platform"
  cd "${build_dirs[$i]}"
  echo {\"branch\": \"$TRAVIS_BRANCH\", \"commit\": \"$TRAVIS_COMMIT\", \"build\": $TRAVIS_BUILD_NUMBER} > build.json
  zip -r -9 "${ARTIFACTS_DIR}/webapp-display-${platforms[$i]}-${TRAVIS_BRANCH}.zip" *
  tar czvf "${ARTIFACTS_DIR}/webapp-display-${platforms[$i]}-${TRAVIS_BRANCH}.tar.gz" *
  cd $PROJECT_DIR
done
