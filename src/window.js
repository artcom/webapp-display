const electron = require("electron")
const omitBy = require("lodash.omitby")
const path = require("path")

const X_FRAME_OPTIONS = "x-frame-options"

module.exports.createWindow = (displayIndex, fullscreen, windowedFullscreen, url, logger) => {
  const display = getDisplay(displayIndex, logger)
  const session = electron.session.fromPartition("persist:webapp-display", { cache: true })

  const options = {
    fullscreen,
    session,
    x: display.bounds.x,
    y: display.bounds.y,
    frame: !fullscreen,
    webPreferences: {
      webviewTag: true,
      preload: path.join(electron.app.getAppPath(), "src", "preload.js"),
      webSecurity: false
    }
  }

  if (windowedFullscreen) {
    options.width = display.workAreaSize.width
    options.height = display.workAreaSize.height
  }

  const win = new electron.BrowserWindow(options)
  win.setMenu(null)
  setupEventHandler(win, url, logger)

  removeIncomingXFrameHeaders()

  logger.info(`Loading url: ${url}`)
  win.loadURL(url)

  return win
}

function setupEventHandler(win, url, logger) {
  win.on("unresponsive", () => logger.info("The application has become unresponsive."))

  win.webContents.on("crashed", (event, killed) => logger.info(
    `Renderer process crashed\n${JSON.stringify(event)}\nKilled: ${JSON.stringify(killed)}`
  ))

  win.webContents.on("did-fail-load", (event, code, description, validatedUrl) => {
    logger.info(`Load failed: ${validatedUrl}\nDescription: ${description}\nError Code: ${code}`)

    if (validatedUrl === url) {
      setTimeout(() => win.webContents.reload(), 1000)
    }
  })

  win.webContents.on("new-window", (event, newWindowUrl) => {
    logger.info(`Prevented opening a new browser window for url: ${newWindowUrl}`)
    event.preventDefault()
  })
}

function removeIncomingXFrameHeaders() {
  electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      cancel: false,
      responseHeaders: omitBy(
        details.responseHeaders,
        (value, key) => key.toLowerCase() === X_FRAME_OPTIONS
      )
    })
  })
}

function getDisplay(index, logger) {
  const displays = electron.screen.getAllDisplays()
  const display = displays[index]
  if (!display) {
    logger.info(`Display must be between 0 and ${displays.length - 1} (not ${index})`)
    process.exit(1)
  }

  return display
}
