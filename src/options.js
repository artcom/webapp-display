const { app } = require("electron")
const kebabCase = require("lodash.kebabcase")
const minimist = require("minimist")
const path = require("path")

const packageJson = require("../package.json")

const DEFAULTS = {
  bootstrapUrl: "http://bootstrap-server/device",
  config: "config.json",
  display: 0,
  fullscreen: false,
  webApp: "webapp",
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
const configFilePath = path.join(app.getAppPath(), getOption("config", "c"))
fileOptions = require(configFilePath) || {}

function getOption(name, shorthand) {
  if (cliOptions.hasOwnProperty(kebabCase(name))) {
    return cliOptions[kebabCase(name)]
  }

  if (shorthand && cliOptions.hasOwnProperty(shorthand)) {
    return cliOptions[shorthand]
  }

  if (fileOptions.hasOwnProperty(name)) {
    return fileOptions[name]
  }

  return DEFAULTS[name]
}

module.exports = {
  bootstrapUrl: getOption("bootstrapUrl", "b"),
  display: getOption("display", "d"),
  fullscreen: getOption("fullscreen", "f"),
  webApp: getOption("webApp", "w"),
  windowedFullscreen: getOption("windowedFullscreen", "F")
}
