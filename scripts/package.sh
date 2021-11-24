#!/bin/bash

set -eo pipefail

BUILD_DIR="build/win-unpacked"
ARTIFACTS_DIR="artifacts"

echo "Packaging"
mkdir "${ARTIFACTS_DIR}"
cd "${BUILD_DIR}"
echo {\"branch\": \"$TRAVIS_BRANCH\", \"commit\": \"$TRAVIS_COMMIT\", \"build\": $TRAVIS_BUILD_NUMBER} > build.json
zip -r -9 "../../${ARTIFACTS_DIR}/webapp-display-${TRAVIS_BRANCH}.zip" *
tar czvf "../../${ARTIFACTS_DIR}/webapp-display-${TRAVIS_BRANCH}.tar.gz" *
