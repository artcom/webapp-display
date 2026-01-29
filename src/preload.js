const { webFrame, ipcRenderer } = require("electron")

webFrame.setVisualZoomLevelLimits(1, 1)

// Store original console methods before overriding
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
}

const logLevels = ["log", "info", "warn", "error", "debug"]
logLevels.forEach((level) => {
  console[level] = (...args) => {
    try {
      ipcRenderer.send("renderer-console", {
        level,
        message: args.map(serialize),
        fromPreload: true,
      })
    } catch (e) {
      // If IPC fails, use original console to avoid losing the message
      originalConsole[level]("IPC logging failed:", e)
    }

    // Call original to maintain normal console behavior (appears in DevTools)
    originalConsole[level].apply(console, args)
  }
})

function serialize(arg) {
  if (arg instanceof Error) {
    return {
      __type: "Error",
      name: arg.name,
      message: arg.message,
      stack: arg.stack,
    }
  }

  if (typeof arg === "function") {
    return `[Function: ${arg.name || "anonymous"}]`
  }

  if (arg instanceof HTMLElement) {
    return `[HTMLElement: ${arg.tagName}]`
  }

  if (arg === window) return "[Window]"
  if (arg === document) return "[Document]"

  try {
    structuredClone(arg)
    return arg
  } catch (e) {
    return Object.prototype.toString.call(arg)
  }
}
