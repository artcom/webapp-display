const electron = require("electron")

const bootstrap = require("@artcom/bootstrap-client")
const config = require("./options")
const createMenu = require("./menu")
const { createWindow } = require("./window")
const { CredentialsFiller, loadCredentials } = require("./credentials")

const SERVICE_ID = "webappDisplay"

electron.app.commandLine.appendSwitch("ignore-certificate-errors")

electron.app.commandLine.appendSwitch("ignore-autoplay-restrictions")
electron.app.commandLine.appendSwitch("no-user-gesture-required")
electron.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required")

electron.app.commandLine.appendSwitch("touch-events", "enabled")
electron.app.commandLine.appendSwitch("enable-features", "OverlayScrollbar")

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
  const { logger, mqttClient, data } = await bootstrap(config.bootstrapUrl, SERVICE_ID)

  config.windows.forEach(async ({ deviceSuffix, webAppUrl, bounds, displayIndex }) => {
    const deviceTopic = appendSuffix(data.deviceTopic, deviceSuffix)
    const device = appendSuffix(data.device, deviceSuffix)
    const windowData = { ...data, deviceTopic, device }

    logger.info("Options:", config)

    const params = new URLSearchParams(windowData).toString()
    const url = `${webAppUrl}/?${params}`

    const window = createWindow(device, url, bounds, displayIndex, logger)

    mqttClient.subscribe(`${deviceTopic}/doClearCache`, () => {
      window.webContents.session.clearCache().then(() => {
        logger.info("Cache cleared")
      })
    })

    electron.Menu.setApplicationMenu(createMenu())

    const credentialsData = await loadCredentials(data.httpBrokerUri)
    const credentialsFiller = new CredentialsFiller(window.webContents, credentialsData, logger)
    credentialsFiller.listen()
  })

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

function appendSuffix(baseName, suffix, divider = "-") {
  return suffix ? `${baseName}${divider}${suffix}` : baseName
}
