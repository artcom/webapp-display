const electron = require("electron")
const pickBy = require("lodash.pickby")
const path = require("path")

const X_FRAME_OPTIONS = "x-frame-options"

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
      nodeIntegration: false,
      webSecurity: false
    }
  }

  if (windowedFullscreen) {
    options.width = display.workAreaSize.width
    options.height = display.workAreaSize.height
  }

  const win = new electron.BrowserWindow(options)
  win.setMenu(null)
  setupEventHandler(win)

  removeIncomingXFrameHeaders()

  return win
}

function setupEventHandler(win) {
  win.on("unresponsive", () => console.log("The application has become unresponsive."))

  win.webContents.on("crashed", (event, killed) => console.log(
    `Renderer process crashed\n${JSON.stringify(event)}\nKilled: ${JSON.stringify(killed)}`
  ))

  win.webContents.on("did-fail-load", (event, code, description, validatedUrl) => {
    console.log(`Load failed: ${validatedUrl}\nDescription: ${description}\nError Code: ${code}`)
    setTimeout(() => win.webContents.reload(), 1000)
  })
}

function removeIncomingXFrameHeaders() {
  electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      cancel: false,
      responseHeaders: pickBy(
        details.responseHeaders,
        (value, key) => key.toLowerCase() !== X_FRAME_OPTIONS
      )
    })
  })
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
