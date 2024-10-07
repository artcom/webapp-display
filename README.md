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
  - `logDir` optional, path to persist the log files, default: `./logs`
  - `bounds` optional, if not set the window mode will be fullscreen, example: `{ x: 0, y: 0, width: 800, height: 600 }`
  - `deviceEmulation` optional, example: `{ type: "desktop", bounds: { width: 3840, height: 2160 } }`

### Multi Window

- Make a copy of `config.json.multiWindowTemplate` and rename it to `config.json`
- it contains these options
  - `bootstrapUrl`
  - `windows` it contains all options of `single window` plus:
    - `deviceSuffix` optional, default: `null`

When using multiple windows each window should get a `deviceSuffix`. This suffix will be appended to the device name from the bootstrap server using `-` as a separator. This results in a unique `device` and `deviceTopic` for each window (e.g. `bootstrapUrl="http://example.com/device-P1"` and `deviceSuffix="Left"` results in `device="device-P1-Left"` and `deviceTopic="devices/device-P1-Left"`).

## Logs

Logs are written to the `logDir` specified in the configuration file. The log files are named `webapp-display-YYYY-MM-DD.log`. The logs are rotated daily and the number of log files is limited to 7.

## Usage

- Start the application with `npm start`

### Clear Cache via MQTT API

The app subscribes to the topic `devices/<device>/doClearCacheAndRestart`. Messages on this topic cause the disk cache to be cleared and the app window to be restarted. The restart is necessary so that the memory cache is also discarded in addition to the deleted disk cache.

### Automatic Website Interactions

Some websites require login credentials or cookie accecption (cookie banner). These interactions can be automated with an interaction configuration.
examples:

```
  {
    "url": "https://live.relution.io/",
    "interactions": [
      {
        "selector": "input#mat-input-1",
        "input": "name"
      },
      {
        "selector": "input#mat-input-0",
        "input": "password"
      },
      {
        "selector": "[id=BTN_LOGIN]"
      }
    ]
  },
  {
    "url": "https://www.telekom-beethoven-competition.de/itbcb-de",
    "interactions": [
      {
        "delay": 2500,
        "selector": "[data-cookie-optin-set=all]",
        "index": 1
      }
    ]
  }
```

- _selector_ is the element to be clicked on.
- _input_ value is used for input fields.
- _index_ is used to get the right selector, because sometimes there are multiple selectors without an specific id. Default index is 0.

- _delay_ is needed when cookiebanners just appear after a few seconds.

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

### Troubleshoot Hints

In the follwing cases the credentials fill-in functionality is not working correctly:

- When devtools are opened, the window is resized and the second input field can't be found.
- When the same site is loaded instantly again without logging in before. The credentials are filled in the elements of the "old" disappearing iframe in this case.
