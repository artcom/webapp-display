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
  - `fullscreen` optional, default: `true`
  - `geometry` optional, if not fullscreen, default: `{ x: 0, y: 0, width: 800, height: 600 }`

### Multi Window

When using multiple windows each window should get an `deviceSuffix`. This suffix will be appended to the device name from the bootstrap server using `-` as a separator. This result in a unique `device` and `deviceTopic` for each window (e.g. `bootstrapUrl="http://example.com/device-P1"` and `deviceSuffix="Left"` result in `device="device-P1-Left"` and `deviceTopic="devices/device-P1-Left"`).

- Make a copy of `config.json.multiWindowTemplate` and rename it to `config.json`
- it contains these options
  - `bootstrapUrl`
  - `windows` it contains all `single window` options plus:
    - `deviceSuffix` optional, default: null

## Usage

- Start the application: `npm run dev`
- Start the application in fullscreen: `npm start`

### Clear the cache of window

The application listens to the mqtt topic `devices/<device>/doClearCache` which triggers the cache clearing.
The respective broker is obtained by the bootstrap data.

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

Final build output is located at `build/win-unpacked`.
