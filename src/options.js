const kebabCase = require("lodash.kebabcase")
const minimist = require("minimist")
const path = require("path")

const packageJson = require("../package.json")

const DEFAULTS = {
  bootstrapUrl: "http://bootstrap-server/device",
  config: "config.json",
  display: 0,
  geometry: { x: 0, y: 0, width: 800, height: 600 },
  fullscreen: false,
  webAppUrl: null,
}

const USAGE = `
Usage: webapp-display [options]

Options:
  -b --bootstrap-url          Use a specific bootstrap url
  -c --config                 Use a specific config file
  -d --display <display>      Use a specific display device
  -f --fullscreen             Open app in fullscreen mode
  -u --web-app-url            The webAppUrl to load on start

  -h --help                   Show usage information
  -v --version                Show version information
`

const skippedArgs = process.argv[0].includes("electron") ? 2 : 1
const cliOptions = minimist(process.argv.slice(skippedArgs))
console.log("~ cliOptions", cliOptions)

if (cliOptions.help || cliOptions.h) {
  console.log(USAGE.trim())
  process.exit()
}

if (cliOptions.version || cliOptions.v) {
  console.log(packageJson.version)
  process.exit()
}

let fileOptions
const configFile = getOption("config", "c")
if (configFile === DEFAULTS.config) {
  try {
    fileOptions = require(path.resolve(configFile))
  } catch (error) {
    /* ignore */
  }
} else {
  fileOptions = require(path.resolve(configFile))
}

function getOption(name, shorthand, fileOptionsItem) {
  if (Object.prototype.hasOwnProperty.call(cliOptions, kebabCase(name))) {
    return cliOptions[kebabCase(name)]
  }

  if (shorthand && Object.prototype.hasOwnProperty.call(cliOptions, shorthand)) {
    return cliOptions[shorthand]
  }

  if (Object.prototype.hasOwnProperty.call(fileOptionsItem, name)) {
    return fileOptionsItem[name]
  }

  return DEFAULTS[name]
}

function getOptions(fileOptionsItem) {
  return {
    bootstrapUrl: getOption("bootstrapUrl", "b", fileOptionsItem),
    display: getOption("display", "d", fileOptionsItem),
    geometry: getOption("geometry", "d", fileOptionsItem),
    fullscreen: getOption("fullscreen", "f", fileOptionsItem),
    webApp: getOption("webApp", "w", fileOptionsItem),
    webAppUrl: getOption("webAppUrl", "u", fileOptionsItem),
    windowedFullscreen: getOption("windowedFullscreen", "F", fileOptionsItem),
  }
}

fileOptions = Array.isArray(fileOptions) ? fileOptions : [fileOptions]

module.exports = fileOptions.map((fileOptionsItem) => getOptions(fileOptionsItem))
