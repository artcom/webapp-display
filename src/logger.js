const { createLogger, Winston } = require("@artcom/logger")
const WinstonDailyRotateFile = require("winston-daily-rotate-file")
const { join, isAbsolute } = require("path")
const { is } = require("@electron-toolkit/utils")
const { app } = require("electron")

const DEFAULT_LOG_DIR = "./logs"

const logPath = getFullPath(DEFAULT_LOG_DIR)
const logger = createLoggerWithDir(logPath)

function createLoggerWithDir(logDir) {
  const transports = [
    new Winston.transports.Console({ level: "warn" }),
    new WinstonDailyRotateFile({
      dirname: logDir,
      filename: `webapp-display-%DATE%.log`,
      datePattern: "YYYY-MM-DD-HH-mm",
      maxSize: "100M",
      maxFiles: "7d",
    }),
  ]

  return createLogger({ transports })
}

function getFullPath(dir) {
  return isAbsolute(dir) ? dir : join(is.dev ? app.getAppPath() : app.getPath("userData"), dir)
}

module.exports = { logger }
