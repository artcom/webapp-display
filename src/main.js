const electron = require("electron")
const querystring = require("querystring")
const topping = require("mqtt-topping").default

require("electron-debug")()
const bootstrapClient = require("@artcom/bootstrap-client")

const bootstrap = require("./bootstrap")
const options = require("./options")
const { createWindow } = require("./window")
const { CredentialsFiller, loadCredentials } = require("./credentials")

const bootstrapUrl = process.env.BOOTSTRAP_SERVER_URI
const serviceId = "webappDisplay"

let mainWindow = null

electron.app.commandLine.appendSwitch("ignore-certificate-errors")

electron.app.commandLine.appendSwitch("ignore-autoplay-restrictions")
electron.app.commandLine.appendSwitch("no-user-gesture-required")
electron.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required")

electron.app.on("ready", async () => {
  bootstrapClient(`${bootstrapUrl}/${serviceId}`, serviceId).then(
    async({logger, mqttClient, data}) => {
      logger.info("Options:")
      logger.info(options)

      logger.info("Requesting bootstrap data...")
      const bootstrapData = await bootstrap(options.bootstrapUrl)
      logger.info(JSON.stringify(bootstrapData))

      const url = options.webAppUrl ?
        `${options.webAppUrl}/?${querystring.stringify(bootstrapData)}`
        :
        `http://${options.webApp}.${bootstrapData.backendHost}/?${querystring.stringify(bootstrapData)}`

      mainWindow = createWindow(options.display, options.fullscreen, options.windowedFullscreen, url, logger)
      mainWindow.on("closed", () => { mainWindow = null })

      const mqtt = topping.connect(bootstrapData.tcpBrokerUri)
      mqtt.subscribe(`${bootstrapData.deviceTopic}/doClearCache`, () => {
        mainWindow.webContents.session.clearCache(() => {
          logger.info("Cache cleared")
        })
      })

      const credentialsData = await loadCredentials(bootstrapData.httpBrokerUri)
      const credentialsFiller = new CredentialsFiller(mainWindow.webContents, credentialsData)
      credentialsFiller.listen()
  })
})

electron.app.commandLine.appendSwitch("touch-events", "enabled")

electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit()
  }
})
