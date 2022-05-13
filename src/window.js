const electron = require("electron")
const omitBy = require("lodash.omitby")
const path = require("path")

module.exports.createWindow = (id, url, bounds, displayId, logger) => {
  const session = electron.session.fromPartition(`persist:webapp-display-${id}`, { cache: true })
  const isfullscreen = !bounds
  const windowBounds = bounds || { x: 0, y: 0, width: 800, height: 600 }
  const display = getDisplay(displayId)

  const options = {
    fullscreen: isfullscreen,
    session,
    x: windowBounds.x + display.bounds.x,
    y: windowBounds.y + display.bounds.y,
    width: windowBounds.width,
    height: windowBounds.height,
    frame: !isfullscreen,
    roundedCorners: isfullscreen,
    autoHideMenuBar: isfullscreen,
    webPreferences: {
      webviewTag: true,
      preload: path.join(electron.app.getAppPath(), "src", "preload.js"),
      webSecurity: false,
      contextIsolation: false,
    },
  }

  const win = new electron.BrowserWindow(options)
  win.setMenu(null)
  setupEventHandler(win, url, logger)

  filterResponseHeaders()

  logger.info(`Loading url: ${url}`)
  win.loadURL(url)

  return win
}

function setupEventHandler(win, url, logger) {
  win.on("unresponsive", () => logger.info("The application has become unresponsive."))

  win.webContents.on("render-process-gone", (event, details) =>
    logger.info(`Render process gone, reason: ${details.reason}`)
  )

  win.webContents.on("did-fail-load", (event, code, description, validatedUrl) => {
    logger.info(`Load failed: ${validatedUrl}\nDescription: ${description}\nError Code: ${code}`)

    if (validatedUrl === url) {
      setTimeout(() => win.webContents.reload(), 1000)
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    logger.info(`Prevented opening a new browser window for url: ${url}`)
    return { action: "deny" }
  })
}

function filterResponseHeaders() {
  electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "*",
        ...omitBy(details.responseHeaders, (value, key) =>
          [
            "x-frame-options",
            "content-security-policy",
            "access-control-allow-origin",
            "access-control-allow-headers",
            "access-control-allow-methods",
          ].includes(key.toLowerCase())
        ),
      },
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
