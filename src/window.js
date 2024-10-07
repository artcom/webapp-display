const electron = require("electron")
const path = require("path")

module.exports.createWindow = ({
  sessionId,
  url,
  bounds,
  alwaysOnTop,
  deviceEmulation,
  display,
  logger,
}) => {
  const session = electron.session.fromPartition(`persist:webapp-display-${sessionId}`, {
    cache: true,
  })
  const isFullscreen = bounds === null
  const windowBounds = { x: 0, y: 0, width: 800, height: 600, ...bounds }
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
    isFullscreen ? options : { ...options, ...windowedOptions, title: sessionId }
  )

  win.setMenu(null)

  if (alwaysOnTop) {
    win.setAlwaysOnTop(true, "normal")
  }

  setupEventHandler(win, url, logger, deviceEmulation)

  modifyResponseHeaders(session)

  logger.info(`Loading url: ${url}`)
  win.loadURL(url)

  return win
}

function setupEventHandler(win, url, logger, deviceEmulation) {
  win.on("unresponsive", () => logger.info("The application has become unresponsive."))
  win.on("page-title-updated", (event) => event.preventDefault())
  win.on("focus", () => logger.info("Window focused"))
  win.on("blur", () => logger.info("Window blurred"))

  win.webContents.on("console-message", (event, level, message) => {
    switch (level) {
      case 0:
        return logger.debug(message)
      case 1:
        return logger.info(message)
      case 2:
        return logger.warn(message)
      case 3:
        return logger.error(message)
      default:
        return logger.info(message)
    }
  })

  win.webContents.on("render-process-gone", (event, details) =>
    logger.info(`Render process gone, reason: ${details.reason}`)
  )

  if (deviceEmulation) {
    if (deviceEmulation.enforceAspectRatio) {
      const aspectRatio = deviceEmulation.bounds.width / deviceEmulation.bounds.height
      win.setAspectRatio(aspectRatio)

      const { width, height } = win.getBounds()
      const shortSide = Math.min(width, height)
      win.setSize(Math.round(shortSide * aspectRatio), shortSide)
    }

    // Use Chrome DevTools Protocol (https://chromedevtools.github.io/devtools-protocol/)
    win.webContents.on("dom-ready", () => {
      try {
        win.webContents.debugger.attach()
        win.webContents.debugger.sendCommand(
          "Emulation.setDeviceMetricsOverride",
          getDeviceEmulationOverrides(deviceEmulation, win.getBounds())
        )
        win.webContents.debugger.sendCommand("Emulation.setTouchEmulationEnabled", {
          enabled: true,
        })
        win.webContents.debugger.sendCommand("Emulation.setEmitTouchEventsForMouse", {
          enabled: true,
          configuration: "mobile",
        })
      } catch (err) {
        logger.warn("Debugger attach failed : ", err)
      }
    })

    win.on("resized", () => {
      win.webContents.debugger.sendCommand(
        "Emulation.setDeviceMetricsOverride",
        getDeviceEmulationOverrides(deviceEmulation, win.getBounds())
      )
    })
  }

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

function convertAllKeysToLowerCase(obj) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [key.toLowerCase(), value]))
}

function getFitToViewRatio(deviceEmulationBounds, windowBounds) {
  const { width: windowWidth, height: windowHeight } = windowBounds
  const { width: emulationWidth, height: emulationHeight } = deviceEmulationBounds
  return Math.min(windowWidth / emulationWidth, windowHeight / emulationHeight)
}

function getDeviceEmulationOverrides(deviceEmulation, windowBounds) {
  return {
    width: deviceEmulation.bounds.width,
    height: deviceEmulation.bounds.height,
    deviceScaleFactor: deviceEmulation.devicePixelRatio || 2,
    dontSetVisibleSize: true,
    scale: getFitToViewRatio(deviceEmulation.bounds, windowBounds),
    mobile: deviceEmulation.isMobile || false,
  }
}
