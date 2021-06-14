const electron = require("electron")
const querystring = require("querystring")

const bootstrap = require("@artcom/bootstrap-client")
const options = require("./options")
const { createWindow } = require("./window")
const { CredentialsFiller, loadCredentials } = require("./credentials")

const serviceId = "webappDisplay"

let mainWindow = null

electron.app.commandLine.appendSwitch("ignore-certificate-errors")

electron.app.commandLine.appendSwitch("ignore-autoplay-restrictions")
electron.app.commandLine.appendSwitch("no-user-gesture-required")
electron.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required")

electron.app.commandLine.appendSwitch("touch-events", "enabled")

electron.app.on("ready", async () => {
  bootstrap(options.bootstrapUrl, serviceId).then(
    async ({ logger, mqttClient, data }) => {
      const bootstrapData = data

      logger.info("Options:", options)

      const url = options.webAppUrl
        ? `${options.webAppUrl}/?${querystring.stringify(bootstrapData)}`
        : `http://${options.webApp}.${bootstrapData.backendHost}/?${querystring.stringify(bootstrapData)}`

      mainWindow = createWindow(
        options.display,
        options.fullscreen,
        options.windowedFullscreen,
        url,
        logger
      )

      mainWindow.on("closed", () => { mainWindow = null })

      mqttClient.subscribe(`${bootstrapData.deviceTopic}/doClearCache`, () => {
        mainWindow.webContents.session.clearCache(() => {
          logger.info("Cache cleared")
        })
      })

      const credentialsData = await loadCredentials(bootstrapData.httpBrokerUri)

      const credentialsFiller = new CredentialsFiller(
        mainWindow.webContents, credentialsData, logger
      )

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
