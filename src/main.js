const electron = require("electron")
const querystring = require("querystring")

require("electron-debug")()

const bootstrap = require("./bootstrap")
const options = require("./options")
const { createWindow } = require("./window")
const { CredentialsFiller, loadCredentials } = require("./credentials")

let mainWindow = null

electron.app.commandLine.appendSwitch("ignore-certificate-errors")

electron.app.commandLine.appendSwitch("ignore-autoplay-restrictions")
electron.app.commandLine.appendSwitch("no-user-gesture-required")
electron.app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required")

electron.app.on("ready", async () => {
  console.log("Options:")
  console.log(options)

  console.log("Requesting bootstrap data...")
  const bootstrapData = await bootstrap(options.bootstrapUrl)
  console.log(JSON.stringify(bootstrapData))

  const url = options.webAppUrl ?
    `${options.webAppUrl}/?${querystring.stringify(bootstrapData)}`
    :
    `http://${options.webApp}.${bootstrapData.backendHost}/?${querystring.stringify(bootstrapData)}`

  mainWindow = createWindow(options.display, options.fullscreen, options.windowedFullscreen, url)
  mainWindow.on("closed", () => { mainWindow = null })

  const credentialsData = await loadCredentials(bootstrapData.httpBrokerUri)
  const credentialsFiller = new CredentialsFiller(mainWindow.webContents, credentialsData)
  credentialsFiller.listen()
})

electron.app.commandLine.appendSwitch("touch-events", "enabled")

electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit()
  }
})
