const electron = require("electron")
const path = require("path")

module.exports.createWindow = (sessionId, url, bounds, displayId, logger) => {
  const session = electron.session.fromPartition(`persist:webapp-display-${sessionId}`, {
    cache: true,
  })
  const isFullscreen = bounds === null
  const windowBounds = { x: 0, y: 0, width: 800, height: 600, ...bounds }
  const display = getDisplay(displayId, logger)
  const windowedOptions = {
    width: windowBounds.width,
    height: windowBounds.height,
    frame: false,
    transparent: true,
  }

  const options = {
    fullscreen: isFullscreen,
    x: windowBounds.x + display.bounds.x,
    y: windowBounds.y + display.bounds.y,
    autoHideMenuBar: true,
    webPreferences: {
      session,
      webviewTag: true,
      preload: path.join(electron.app.getAppPath(), "src", "preload.js"),
      webSecurity: false,
      contextIsolation: false,
    },
  }

  const win = new electron.BrowserWindow(
    isFullscreen ? options : { ...options, ...windowedOptions }
  )

  win.setMenu(null)
  setupEventHandler(win, url, logger)

  modifyResponseHeaders(session)

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

function modifyResponseHeaders(session) {
  session.webRequest.onHeadersReceived((details, callback) => {
    const modifiedHeaders = convertAllKeysToLowerCase(details.responseHeaders)
    delete modifiedHeaders["x-frame-options"]
    delete modifiedHeaders["content-security-policy"]

    const credentialsHeader = modifiedHeaders["access-control-allow-credentials"]
    if (!credentialsHeader) {
      modifiedHeaders["access-control-allow-origin"] = "*"
    }
    modifiedHeaders["access-control-allow-headers"] = "*"
    modifiedHeaders["access-control-allow-methods"] = "*"

    const setCookies = modifiedHeaders["set-cookie"]
    if (setCookies) {
      modifiedHeaders["set-cookie"] = setCookies.map((cookie) => resolveCookie(cookie))
    }

    callback({ responseHeaders: modifiedHeaders })
  })
}

function resolveCookie(cookie) {
  const parts = cookie.split(";").map((part) => part.trim())

  if (!parts.find((item) => item.toLowerCase() === "secure")) {
    parts.push("Secure")
  }

  const index = parts.findIndex((item) => item.toLowerCase().startsWith("samesite"))
  if (index > 0) {
    parts[index] = "SameSite=none"
  } else {
    parts.push("SameSite=none")
  }

  return parts.join("; ")
}

function getDisplay(index, logger) {
  const displays = electron.screen.getAllDisplays()
  const display = displays[index]
  if (!display) {
    logger.error(
      `No display found for display index ${index}. Available range: 0 to ${displays.length - 1}.`
    )
  }

  return display
}

function convertAllKeysToLowerCase(obj) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value]))
}
