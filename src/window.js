const electron = require("electron")
const omitBy = require("lodash.omitBy")
const path = require("path")

const X_FRAME_OPTIONS = "x-frame-options"

module.exports.createWindow = (displayIndex, fullscreen, windowedFullscreen, url) => {
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
  setupEventHandler(win, url)

  removeIncomingXFrameHeaders()

  console.log(`Loading url: ${url}`)
  win.loadURL(url)

  return win
}

function setupEventHandler(win, url) {
  win.on("unresponsive", () => console.log("The application has become unresponsive."))

  win.webContents.on("crashed", (event, killed) => console.log(
    `Renderer process crashed\n${JSON.stringify(event)}\nKilled: ${JSON.stringify(killed)}`
  ))

  win.webContents.on("did-fail-load", (event, code, description, validatedUrl) => {
    console.log(`Load failed: ${validatedUrl}\nDescription: ${description}\nError Code: ${code}`)

    if (validatedUrl === url) {
      setTimeout(() => win.webContents.reload(), 1000)
    }
  })

  win.webContents.on("new-window", (event, url) => {
    console.log(`Prevented opening a new browser window for url: ${url}`)
    event.preventDefault()
  })
}

function removeIncomingXFrameHeaders() {
  electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      cancel: false,
      responseHeaders: omitBy(
        details.responseHeaders,
        (value, key) => key.toLowerCase() === X_FRAME_OPTIONS
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
