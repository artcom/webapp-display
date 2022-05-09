const electron = require("electron")

const bootstrap = require("@artcom/bootstrap-client")
const optionsList = require("./options")
const createMenu = require("./menu")
const { createWindow } = require("./window")
const { CredentialsFiller, loadCredentials } = require("./credentials")

const serviceId = "webappDisplay"

let mainWindow = null

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
  optionsList.forEach(async (options) => {
    const { logger, mqttClient, data } = await bootstrap(options.bootstrapUrl, serviceId)
    logger.info("Options:", options)

    const params = new URLSearchParams(data).toString()
    const url = `${options.webAppUrl}/?${params}`
    const display = getDisplay(options.display, logger)

    const window = createWindow(
      url,
      {
        x: options.geometry.x + display.bounds.x,
        y: options.geometry.y + display.bounds.y,
        width: options.geometry.width,
        height: options.geometry.height,
      },
      options.fullscreen,
      logger
    )

    mqttClient.subscribe(`${data.deviceTopic}/doClearCache`, () => {
      window.webContents.session.clearCache(() => {
        logger.info("Cache cleared")
      })
    })

    electron.Menu.setApplicationMenu(createMenu())

    const credentialsData = await loadCredentials(data.httpBrokerUri)
    const credentialsFiller = new CredentialsFiller(mainWindow.webContents, credentialsData, logger)
    credentialsFiller.listen()

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
})

electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit()
  }
})

function getDisplay(index, logger) {
  const displays = electron.screen.getAllDisplays()
  const display = displays[index]
  if (!display) {
    logger.info(`Display must be between 0 and ${displays.length - 1} (not ${index})`)
    process.exit(1)
  }

  return display
}
