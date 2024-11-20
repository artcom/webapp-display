const { memoryUsage } = require("node:process")

function getFormattedMemory([memoryTitle, memoryValueInBit]) {
  return `${memoryTitle}: ${(memoryValueInBit / (1024 * 1024)).toFixed(2)} MB`
}

function getFormattedMemoryUsage() {
  const formattedMemoryUsageList = `MemoryUsage: ${Object.entries(memoryUsage())
    .flatMap(getFormattedMemory)
    .join(", ")}`

  return formattedMemoryUsageList
}

module.exports = { getFormattedMemoryUsage }
