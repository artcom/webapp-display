const minimist = require("minimist")
const path = require("path")

const packageJson = require("../package.json")

const DEFAULT_CONFIG_FILE = "./config.json"
const DEFAULT_LOG_DIR = "./logs"

const DEFAULT_WINDOW_CONFIG = {
  displayIndex: 0,
  bounds: null,
  deviceEmulationBounds: null,
  deviceSuffix: null,
  alwaysOnTop: true,
}

const USAGE = `
  Usage: webapp-display [options]

  Options:
    -c --configFile             Use a specific config file, default: ${DEFAULT_CONFIG_FILE}
    -i --inlineConfig           Use the given parameter as JSON config
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

let config = null
if (cliOptions.inlineConfig || cliOptions.i) {
  config = JSON.parse(cliOptions.inlineConfig || cliOptions.i)
} else {
  const configFile = cliOptions.configFile || cliOptions.c || DEFAULT_CONFIG_FILE

  try {
    config = require(path.resolve(configFile))
  } catch (error) {
    throw new Error(`Missing config file: ${configFile}`)
  }
}

module.exports = {
  bootstrapUrl: config.bootstrapUrl,
  logDir: config.logDir || DEFAULT_LOG_DIR,
  windows: config.windows
    ? config.windows.map((windowConfig) => ({ ...DEFAULT_WINDOW_CONFIG, ...windowConfig }))
    : [{ ...DEFAULT_WINDOW_CONFIG, ...config }],
}
