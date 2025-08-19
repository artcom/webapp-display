var os = require("os")

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function getDeviceEmulationOverrides(deviceEmulation, windowBounds) {
  return {
    width: deviceEmulation.bounds.width,
    height: deviceEmulation.bounds.height,
    deviceScaleFactor: deviceEmulation.devicePixelRatio || 2,
    dontSetVisibleSize: true,
    scale: getFitToViewRatio(deviceEmulation.bounds, windowBounds),
    mobile: deviceEmulation.isMobile || false,
  }
}

function getFitToViewRatio(deviceEmulationBounds, windowBounds) {
  const { width: windowWidth, height: windowHeight } = windowBounds
  const { width: emulationWidth, height: emulationHeight } = deviceEmulationBounds
  return Math.min(windowWidth / emulationWidth, windowHeight / emulationHeight)
}

async function logCpuUsage(logger, repeatCount = 10) {
  let currentUsage = process.cpuUsage()
  let currentTime = process.hrtime()
  for (let i = 0; i < repeatCount; i++) {
    await delay(5000)
    const numCpus = os.cpus().length

    const usageDiff = process.cpuUsage(currentUsage)
    const endTime = process.hrtime(currentTime)

    currentUsage = process.cpuUsage()
    currentTime = process.hrtime()

    const usageMS = (usageDiff.user + usageDiff.system) / 1024
    const totalMS = endTime[0] * 1024 + endTime[1] / 1024 / 1024

    const cpuPercent = (usageMS / totalMS) * 100
    const normPercent = (usageMS / totalMS / numCpus) * 100

    logger.info("CPU Usage", {
      cpuPercent: cpuPercent.toFixed(2),
      normPercent: normPercent.toFixed(2),
    })
  }
}

function formatMemoryUsage(memoryUsageObject) {
  return Object.fromEntries(
    Object.entries(memoryUsageObject).map(([key, bytes]) => [key, `${toMegaBytes(bytes)} MB`])
  )
}

function toMegaBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2)
}

module.exports = {
  delay,
  getDeviceEmulationOverrides,
  logCpuUsage,
  formatMemoryUsage,
  toMegaBytes,
}
