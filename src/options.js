const minimist = require("minimist")
const path = require("path")

const packageJson = require("../package.json")

const DEFAULT_CONFIG_FILE = "./config.json"
const DEFAULT_WINDOW_CONFIG = {
  displayIndex: 0,
  bounds: null,
  deviceSuffix: null,
}

const USAGE = `
  Usage: webapp-display [options]

  Options:
    -c --configFile             Use a specific config file, default: ${DEFAULT_CONFIG_FILE}

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

const configFile = cliOptions.configFile || cliOptions.c || DEFAULT_CONFIG_FILE

let config = {}
try {
  config = require(path.resolve(configFile))
} catch (error) {
  throw new Error(`Missing config file: ${configFile}`)
}

module.exports = {
  bootstrapUrl: config.bootstrapUrl,
  windows: config.windows
    ? config.windows.map((windowConfig) => ({ ...DEFAULT_WINDOW_CONFIG, ...windowConfig }))
    : [{ ...DEFAULT_WINDOW_CONFIG, ...config }],
}
