const electron = require("electron")

const bootstrap = require("@artcom/bootstrap-client")
const options = require("./options")
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

electron.app.on("ready", async () => {
  bootstrap(options.bootstrapUrl, serviceId).then(async ({ logger, mqttClient, data }) => {
    logger.info("Options:", options)

    const params = new URLSearchParams(data).toString()
    const url = options.webAppUrl
      ? `${options.webAppUrl}/?${params}`
      : `http://${options.webApp}.${data.backendHost}/?${params}`

    mainWindow = createWindow(
      options.display,
      options.fullscreen,
      options.windowedFullscreen,
      url,
      logger
    )

    mainWindow.on("closed", () => {
      mainWindow = null
    })

    mqttClient.subscribe(`${data.deviceTopic}/doClearCache`, () => {
      mainWindow.webContents.session.clearCache(() => {
        logger.info("Cache cleared")
      })
    })

    const credentialsData = await loadCredentials(data.httpBrokerUri)

    const credentialsFiller = new CredentialsFiller(mainWindow.webContents, credentialsData, logger)

    credentialsFiller.listen()

    electron.Menu.setApplicationMenu(createMenu())

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
