# Webapp Display

A stand-alone display loading a webApp. Based on [Electron](http://electron.atom.io/) and tested on Windows and Mac OS X.

## Setup

* Install [Node.js](http://nodejs.org)
* Install dependencies: `npm install`
* Configure device:
  * Create a `config.json` which contains the `bootstrapUrl` and `webApp` option or provide them via command line (see `npm start -- -h`)

## Usage

* Start the application: `npm run dev`
* Start the application in fullscreen: `npm start`

### Clear the cache of window
The application listens to the mqtt topic `devices/<device>/doClearCache` which triggers the cache clearing.
The respective broker is obtained by the bootstrap data. 

## Build

### for Windows with Docker

run from inside the project directory:

```bash
docker run --rm -ti \
 --env-file <(env | grep -iE 'DEBUG|NODE_|ELECTRON_|YARN_|NPM_|CI|CIRCLE|TRAVIS_TAG|TRAVIS|TRAVIS_REPO_|TRAVIS_BUILD_|TRAVIS_BRANCH|TRAVIS_PULL_REQUEST_|APPVEYOR_|CSC_|GH_|GITHUB_|BT_|AWS_|STRIP|BUILD_') \
 --env ELECTRON_CACHE="/root/.cache/electron" \
 --env ELECTRON_BUILDER_CACHE="/root/.cache/electron-builder" \
 -v ${PWD}:/project \
 -v ${PWD##*/}-node-modules:/project/node_modules \
 -v ~/.cache/electron:/root/.cache/electron \
 -v ~/.cache/electron-builder:/root/.cache/electron-builder \
 electronuserland/builder:wine
```

run from inside the container 
```
npm i
npm run package:win
```

build output is under build/win-unpacked.
