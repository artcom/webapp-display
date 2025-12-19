const { logger } = require("./logger")
const electron = require("electron")

const bootstrap = require("@artcom/bootstrap-client")
const config = require("./options")
const createMenu = require("./menu")
const { createWindow } = require("./window")
const { WebpageInteractor, loadInteractions } = require("./interactions")
const { getDeviceEmulationOverrides } = require("./utils")

const SERVICE_ID = "webappDisplay"
// Store all created browser windows for event propagation
const browserWindows = []

electron.app.commandLine.appendSwitch("ignore-certificate-errors")

electron.app.commandLine.appendSwitch("ignore-autoplay-restrictions")
electron.app.commandLine.appendSwitch("no-user-gesture-required")
electron.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required")

electron.app.commandLine.appendSwitch("touch-events", "enabled")
electron.app.commandLine.appendSwitch("enable-features", "OverlayScrollbar")
electron.app.commandLine.appendSwitch(
  "enable-features",
  "DocumentPolicyIncludeJSCallStacksInCrashReports"
)

electron.app.commandLine.appendSwitch("disable-site-isolation-trials")

if (process.platform === "darwin") {
  electron.systemPreferences.askForMediaAccess("camera")
  electron.systemPreferences.askForMediaAccess("microphone")
}

electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: "http",
    privileges: {
      standard: true,
      secure: true,
      bypassCSP: true,
      allowServiceWorkers: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
])

electron.app.on("ready", async () => {
  const { mqttClient, queryConfig, data } = await bootstrap(config.bootstrapUrl, SERVICE_ID)

  config.windows.forEach(
    async ({ deviceSuffix, webAppUrl, bounds, deviceEmulation, displayIndex, alwaysOnTop }) => {
      const device = appendSuffix(data.device, deviceSuffix)
      const deviceTopic = appendSuffix(data.deviceTopic, deviceSuffix)

      const webAppUrlObj = new URL(webAppUrl)
      appendParamIfNotPresent(webAppUrlObj.searchParams, "device", device)
      appendParamIfNotPresent(webAppUrlObj.searchParams, "deviceTopic", deviceTopic)

      Object.entries(data).forEach(([key, value]) =>
        appendParamIfNotPresent(webAppUrlObj.searchParams, key, value)
      )

      const display = electron.screen.getAllDisplays()[displayIndex]

      const windowOptions = {
        sessionId: device,
        url: webAppUrlObj.toString(),
        bounds,
        alwaysOnTop,
        deviceEmulation,
        display,
        logger,
      }
      logger.info("Window Options:", windowOptions)

      if (display) {
        let window = createWindow(windowOptions)
        browserWindows.push(window)

        window.on("closed", () => {
          const index = browserWindows.indexOf(window)
          if (index !== -1) {
            browserWindows.splice(index, 1)
          }
        })

        electron.Menu.setApplicationMenu(createMenu())
        await createWebpageInteractor(data, queryConfig, window, logger)

        mqttClient.subscribe(`${deviceTopic}/doClearCacheAndRestart`, () => {
          window.webContents.session.clearCache().then(async () => {
            logger.info("Cache cleared, Restarting...")
            window.close()
            window = createWindow(windowOptions)
            browserWindows.push(window)
            await createWebpageInteractor(data, queryConfig, window, logger)
          })
        })

        mqttClient.subscribe(`${deviceTopic}/doSendMouseEvent`, (mouseInputEvent) => {
          try {
            logger.info("Received mouse event", mouseInputEvent)
            if (mouseInputEvent.type === "mouseClick") {
              sendInputEvent(window, deviceEmulation, { ...mouseInputEvent, type: "mouseDown" })
              sendInputEvent(window, deviceEmulation, { ...mouseInputEvent, type: "mouseUp" })
            } else {
              sendInputEvent(window, deviceEmulation, mouseInputEvent)
            }
          } catch (error) {
            logger.error(`Failed to process mouse event: ${error.message}`)
          }
        })
      } else {
        logger.error(`No display found for display index ${displayIndex}.`)
      }
    }
  )

  let shuttingDown = false
  process.on("SIGINT", () => {
    if (!shuttingDown) {
      shuttingDown = true
      logger.info("Shutting down")
      mqttClient.disconnect(true)
      process.exit()
    }
  })

  electron.ipcMain.on("renderer-console", (_, { level, message }) => {
    switch (level) {
      case "debug":
        logger.debug(message)
        break
      case "info":
        logger.info(message)
        break
      case "warn":
        logger.warn(message)
        break
      case "error":
        logger.error(message)
        break
      default:
        logger.info(message)
    }
  })
})

electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit()
  }
})

async function createWebpageInteractor(data, queryConfig, window, logger) {
  const interactionData = await loadInteractions(data.configServerUri, queryConfig)
  const webpageInteractor = new WebpageInteractor(window.webContents, interactionData, logger)
  webpageInteractor.listen()
}

function appendSuffix(baseName, suffix, divider = "-") {
  return suffix ? `${baseName}${divider}${suffix}` : baseName
}

function appendParamIfNotPresent(searchParams, key, value) {
  if (!searchParams.has(key)) {
    searchParams.append(key, value)
  }
}

async function sendInputEvent(browserWindow, deviceEmulation, mouseInputEvent) {
  try {
    const scale = deviceEmulation
      ? getDeviceEmulationOverrides(deviceEmulation, browserWindow.getBounds()).scale
      : 1

    browserWindow.webContents.sendInputEvent({
      type: mouseInputEvent.type,
      x: mouseInputEvent.x * scale,
      y: mouseInputEvent.y * scale,
      button: mouseInputEvent.button || "left",
      clickCount: mouseInputEvent.clickCount || 1,
    })
  } catch (error) {
    logger.error(`Failed to inject mouse event: ${error.message}`)
  }
}
