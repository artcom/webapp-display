const electron = require("electron")

const config = require("./options")
const createMenu = require("./menu")
const { createWindow } = require("./window")

electron.app.commandLine.appendSwitch("ignore-certificate-errors")

electron.app.commandLine.appendSwitch("ignore-autoplay-restrictions")
electron.app.commandLine.appendSwitch("no-user-gesture-required")
electron.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required")

electron.app.commandLine.appendSwitch("touch-events", "enabled")
electron.app.commandLine.appendSwitch("enable-features", "OverlayScrollbar")

electron.app.commandLine.appendSwitch("disable-site-isolation-trials")

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
 const logger = console

  config.windows.forEach(
    async ({ deviceSuffix, webAppUrl, bounds, deviceEmulation, displayIndex }) => {
      logger.info("Options:", config)

      const device = appendSuffix("myDevice", deviceSuffix)
      const deviceTopic = appendSuffix("myDeviceTopic", deviceSuffix)

      const webAppUrlObj = new URL(webAppUrl)
      appendParamIfNotPresent(webAppUrlObj.searchParams, "device", device)
      appendParamIfNotPresent(webAppUrlObj.searchParams, "deviceTopic", deviceTopic)

      const display = electron.screen.getAllDisplays()[displayIndex]
      if (display) {
        let window = createWindow(
          device,
          webAppUrlObj.toString(),
          bounds,
          deviceEmulation,
          display,
          logger
        )

        electron.Menu.setApplicationMenu(createMenu())
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
      process.exit()
    }
  })
})

electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit()
  }
})

function appendSuffix(baseName, suffix, divider = "-") {
  return suffix ? `${baseName}${divider}${suffix}` : baseName
}

function appendParamIfNotPresent(searchParams, key, value) {
  if (!searchParams.has(key)) {
    searchParams.append(key, value)
  }
}
