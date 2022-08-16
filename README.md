# Webapp Display

A stand-alone display loading a webApp. Based on [Electron](http://electron.atom.io/) and tested on Windows and Mac OS X.

## Setup

- Install [Node.js](http://nodejs.org)
- Install dependencies: `npm install`

## Configuration

The configuration is provided by a `config.json` file whose path can be specified via the command line (see `npm start -- -h`)

The webapp-display supports a `single window` and a `multi window` configuration.

### Single Window

- Make a copy of `config.json.singleWindowTemplate` and rename it to `./config.json`
- it contains these options
  - `bootstrapUrl`
  - `webAppUrl`
  - `displayIndex` optional, default: `0`
  - `bounds` optional, if not set the window mode will be fullscreen, example: `{ x: 0, y: 0, width: 800, height: 600 }`

### Multi Window

- Make a copy of `config.json.multiWindowTemplate` and rename it to `config.json`
- it contains these options
  - `bootstrapUrl`
  - `windows` it contains all options of `single window` plus:
    - `deviceSuffix` optional, default: `null`

When using multiple windows each window should get a `deviceSuffix`. This suffix will be appended to the device name from the bootstrap server using `-` as a separator. This results in a unique `device` and `deviceTopic` for each window (e.g. `bootstrapUrl="http://example.com/device-P1"` and `deviceSuffix="Left"` results in `device="device-P1-Left"` and `deviceTopic="devices/device-P1-Left"`).

## Usage

- Start the application with `npm start`

### Clear Cache via MQTT API

The app subscribes to the topic `devices/<device>/doClearCacheAndRestart`. Messages on this topic cause the disk cache to be cleared and the app to be restarted. The restart is necessary so that the memory cache is also discarded in addition to the deleted disk cache.

## Build

### Windows with Docker

Run from inside the project directory:

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

Run from inside the container:

```
npm i
npm run package:win
```

### Install on OS X

```
npm i
npm run package:mac
open -n -a "webapp-display.app" --args -c path/to/config.json
```

Final build output is located at `build/win-unpacked`.

## Performance Improvements

This is a list of some command line arguments (Chromium flags) that can have a positive impact on the app's performance.

```
--force-gpu-rasterization
--enable-native-gpu-memory-buffers
--enable-zero-copy
```
