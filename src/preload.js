const { webFrame, ipcRenderer } = require("electron")

webFrame.setVisualZoomLevelLimits(1, 1)

const logLevels = ["log", "info", "warn", "error", "debug"]
logLevels.forEach((level) => {
  const original = console[level]

  console[level] = (...args) => {
    ipcRenderer.send("renderer-console", {
      level,
      message: args.map(serialize),
    })

    original.apply(console, args)
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
