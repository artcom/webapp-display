const electron = require("electron")
const path = require("path")
var os = require("os")
const {
  getDeviceEmulationOverrides,
  logCpuUsage,
  toMegaBytes,
  formatMemoryUsage,
} = require("./utils")

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

  let enforceFocusTimeout

  win.on("closed", () => {
    if (enforceFocusTimeout) {
      clearTimeout(enforceFocusTimeout)
    }
  })

  if (alwaysOnTop) {
    win.setAlwaysOnTop(true, "pop-up-menu")
    enforceFocusTimeout = setTimeout(() => {
      win.focus()
    }, 10000)
  }

  setupEventHandler(win, url, logger, deviceEmulation)

  modifyResponseHeaders(session)

  logger.info(`Loading url: ${url}`)
  win.loadURL(url)
  win.setSize(windowBounds.width, windowBounds.height)

  return win
}

function setupEventHandler(win, url, logger, deviceEmulation) {
  win.on("page-title-updated", (event) => event.preventDefault())

  win.on("unresponsive", async () => {
    const callStack = await win.webContents.mainFrame.collectJavaScriptCallStack()

    logger.warn("The application has become unresponsive.", {
      processMemoryUsage: formatMemoryUsage(process.memoryUsage()),
      freeMemory: `${toMegaBytes(os.freemem())} MB`,
      totalMemory: `${toMegaBytes(os.totalmem())} MB`,
      upTime: process.uptime(),
      processResourceUsage: process.resourceUsage(),
      callStack,
    })
    logCpuUsage(logger)
  })

  win.on("closed", () => logger.info("Window closed"))

  win.webContents.on("render-process-gone", (event, details) =>
    logger.info(`Render process gone, reason: ${details.reason}`)
  )

  // Attach debugger
  try {
    win.webContents.debugger.attach("1.3")
  } catch (err) {
    logger.info("Debugger attach failed:", err)
  }

  win.webContents.debugger.on("detach", (event, reason) => {
    logger.info("Debugger detached due to:", reason)
  })

  // Listen for console messages from ALL contexts (including iframes)
  win.webContents.debugger.on("message", async (event, method, params) => {
    if (method === "Runtime.consoleAPICalled") {
      const { type, args } = params

      const serializedArgs = await Promise.all(
        args.map(async (arg) => {
          // Simple values come through directly
          if (arg.value !== undefined) {
            return arg.value
          }

          // Complex objects need to be fetched
          if (arg.objectId) {
            try {
              const { result } = await win.webContents.debugger.sendCommand(
                "Runtime.getProperties",
                {
                  objectId: arg.objectId,
                  ownProperties: true,
                  generatePreview: true,
                }
              )

              // Convert properties array to an object
              const obj = {}
              for (const prop of result) {
                if (prop.value) {
                  obj[prop.name] =
                    prop.value.value !== undefined ? prop.value.value : prop.value.description
                }
              }
              return obj
            } catch (err) {
              return `[${arg.className || arg.type}]`
            }
          }

          return arg.description || String(arg)
        })
      )
      if (type === "log") {
        logger.info(`debugger message :`, { serializedArgs, args })
      }
    }
  })

  // Enable Runtime and Console domains
  win.webContents.debugger.sendCommand("Runtime.enable")
  win.webContents.debugger.sendCommand("Console.enable")

  if (deviceEmulation) {
    if (deviceEmulation.enforceAspectRatio) {
      const aspectRatio = deviceEmulation.bounds.width / deviceEmulation.bounds.height
      win.setAspectRatio(aspectRatio)

      const { width, height } = win.getBounds()
      const shortSide = Math.min(width, height)
      win.setSize(Math.round(shortSide * aspectRatio), shortSide)
    }

    // Use Chrome DevTools Protocol (https://chromedevtools.github.io/devtools-protocol/)

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
    modifiedHeaders["document-policy"] = "include-js-call-stacks-in-crash-reports"

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
