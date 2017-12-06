const electron = require("electron")
const querystring = require("querystring")

require("electron-debug")()

const bootstrap = require("./bootstrap")
const options = require("./options")
const { createWindow } = require("./window")
const { CredentialsFiller, loadCredentials } = require("./credentials")

let mainWindow = null

electron.app.on("ready", async () => {
  console.log("Options:")
  console.log(options)

  console.log("Requesting bootstrap data...")
  const bootstrapData = await bootstrap(options.bootstrapUrl)
  console.log(JSON.stringify(bootstrapData))

  mainWindow = createWindow(options.display, options.fullscreen, options.windowedFullscreen)

  const url =
    `http://${options.webApp}.${bootstrapData.backendHost}?${querystring.stringify(bootstrapData)}`
  console.log(`Loading url: ${url}`)
  mainWindow.loadURL(url)
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
