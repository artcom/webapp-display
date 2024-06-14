const electron = require("electron")

const bootstrap = require("@artcom/bootstrap-client")
const config = require("./options")
const createMenu = require("./menu")
const { createWindow } = require("./window")
const { WebpageInteractor, loadInteractions } = require("./interactions")

const SERVICE_ID = "webappDisplay"

electron.app.commandLine.appendSwitch("ignore-certificate-errors")

electron.app.commandLine.appendSwitch("ignore-autoplay-restrictions")
electron.app.commandLine.appendSwitch("no-user-gesture-required")
electron.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required")

electron.app.commandLine.appendSwitch("touch-events", "enabled")
electron.app.commandLine.appendSwitch("enable-features", "OverlayScrollbar")

electron.app.commandLine.appendSwitch("disable-site-isolation-trials")

electron.systemPreferences.askForMediaAccess("camera")
electron.systemPreferences.askForMediaAccess("microphone")
electron.systemPreferences.askForMediaAccess("screen")

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
  const { logger, mqttClient, queryConfig, data } = await bootstrap(config.bootstrapUrl, SERVICE_ID)

  config.windows.forEach(
    async ({
      deviceSuffix,
      webAppUrl,
      bounds,
      deviceEmulation,
      displayIndex,
      alwaysOnTop = true,
    }) => {
      logger.info("Options:", config)

      const device = appendSuffix(data.device, deviceSuffix)
      const deviceTopic = appendSuffix(data.deviceTopic, deviceSuffix)

      const webAppUrlObj = new URL(webAppUrl)
      appendParamIfNotPresent(webAppUrlObj.searchParams, "device", device)
      appendParamIfNotPresent(webAppUrlObj.searchParams, "deviceTopic", deviceTopic)

      Object.entries(data).forEach(([key, value]) =>
        appendParamIfNotPresent(webAppUrlObj.searchParams, key, value)
      )

      const display = electron.screen.getAllDisplays()[displayIndex]
      if (display) {
        let window = createWindow(
          device,
          webAppUrlObj.toString(),
          bounds,
          alwaysOnTop,
          deviceEmulation,
          display,
          logger
        )

        electron.Menu.setApplicationMenu(createMenu())
        await createWebpageInteractor(data, queryConfig, window, logger)

        mqttClient.subscribe(`${deviceTopic}/doClearCacheAndRestart`, () => {
          window.webContents.session.clearCache().then(async () => {
            logger.info("Cache cleared, Restarting...")
            window.close()
            window = createWindow(
              device,
              webAppUrlObj.toString(),
              bounds,
              deviceEmulation,
              display,
              logger
            )
            await createWebpageInteractor(data, queryConfig, window, logger)
          })
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
