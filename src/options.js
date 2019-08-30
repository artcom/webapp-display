const kebabCase = require("lodash.kebabcase")
const minimist = require("minimist")
const path = require("path")

const packageJson = require("../package.json")

const DEFAULTS = {
  bootstrapUrl: "http://bootstrap-server/device",
  config: "config.json",
  display: 0,
  fullscreen: false,
  webApp: "webApp",
  webAppUrl: null,
  windowedFullscreen: false
}

const USAGE = `
Usage: webapp-display [options]

Options:
  -b --bootstrap-url          Use a specific bootstrap url
  -c --config                 Use a specific config file
  -d --display <display>      Use a specific display device
  -f --fullscreen             Open app in fullscreen mode
  -w --web-app                The webApp to load on start
  -u --web-app-url            The webAppUrl to load on start
  -F --windowed-fullscreen    Open app in windowed fullscreen

  -h --help                   Show usage information
  -v --version                Show version information
`

const skippedArgs = process.argv[0].includes("electron") ? 2 : 1
const cliOptions = minimist(process.argv.slice(skippedArgs))

if (cliOptions.help || cliOptions.h) {
  console.log(USAGE.trim())
  process.exit()
}

if (cliOptions.version || cliOptions.v) {
  console.log(packageJson.version)
  process.exit()
}

let fileOptions = {}
const configFile = getOption("config", "c")
if (configFile === DEFAULTS.config) {
  try {
    fileOptions = require(path.resolve(configFile))
  } catch (error) { /* ignore */ }
} else {
  fileOptions = require(path.resolve(configFile))
}

function getOption(name, shorthand) {
  if (Object.prototype.hasOwnProperty.call(cliOptions, kebabCase(name))) {
    return cliOptions[kebabCase(name)]
  }

  if (shorthand && Object.prototype.hasOwnProperty.call(cliOptions, shorthand)) {
    return cliOptions[shorthand]
  }

  if (Object.prototype.hasOwnProperty.call(fileOptions, name)) {
    return fileOptions[name]
  }

  return DEFAULTS[name]
}

module.exports = {
  bootstrapUrl: getOption("bootstrapUrl", "b"),
  display: getOption("display", "d"),
  fullscreen: getOption("fullscreen", "f"),
  webApp: getOption("webApp", "w"),
  webAppUrl: getOption("webAppUrl", "u"),
  windowedFullscreen: getOption("windowedFullscreen", "F")
}
