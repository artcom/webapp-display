const electron = require("electron")
const path = require("path")

module.exports.createWindow = (displayIndex, fullscreen, windowedFullscreen) => {
  const display = getDisplay(displayIndex)
  const session = electron.session.fromPartition("persist:webapp-display", { cache: true })

  const options = {
    fullscreen,
    session,
    x: display.bounds.x,
    y: display.bounds.y,
    frame: !fullscreen,
    webPreferences: {
      preload: path.join(electron.app.getAppPath(), "src", "preload.js"),
      webSecurity: false
    }
  }

  if (windowedFullscreen) {
    options.width = display.workAreaSize.width
    options.height = display.workAreaSize.height
  }

  const win = new electron.BrowserWindow(options)
  win.setMenu(null)

  win.on("unresponsive", () => console.log("The application has become unresponsive."))

  win.webContents.on("crashed", (event, killed) => console.log(
    `Renderer process crashed\n${JSON.stringify(event)}\nKilled: ${JSON.stringify(killed)}`
  ))

  win.webContents.on("did-fail-load", (event, code, description, validatedUrl) => {
    console.log(`Load failed: ${validatedUrl}\nDescription: ${description}\nError Code: ${code}`)
    setTimeout(() => win.webContents.reload(), 1000)
  })

  return win
}

function getDisplay(index) {
  const displays = electron.screen.getAllDisplays()
  const display = displays[index]
  if (!display) {
    console.log(`Display must be between 0 and ${displays.length - 1} (not ${index})`)
    process.exit(1)
  }

  return display
}
