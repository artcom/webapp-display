const electron = require("electron")
const omitBy = require("lodash.omitby")
const path = require("path")

module.exports.createWindow = (url, geometry, fullscreen, logger) => {
  const session = electron.session.fromPartition("persist:webapp-display", { cache: true })
  const { x = 0, y = 0, width = 800, height = 600 } = geometry

  const options = {
    fullscreen,
    session,
    x,
    y,
    width,
    height,
    frame: !fullscreen,
    roundedCorners: fullscreen,
    autoHideMenuBar: fullscreen,
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

  win.webContents.on("crashed", (event, killed) =>
    logger.info(
      `Renderer process crashed\n${JSON.stringify(event)}\nKilled: ${JSON.stringify(killed)}`
    )
  )

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
