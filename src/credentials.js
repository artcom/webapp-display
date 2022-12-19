const axios = require("axios")
const { session } = require("electron")
const fromPairs = require("lodash.frompairs")

module.exports.CredentialsFiller = class CredentialsFiller {
  constructor(webContents, credentialsData, logger) {
    this.webContents = webContents
    this.credentialsData = credentialsData
    this.logger = logger
    this.previousHostname = null
  }

  async listen() {
    session.defaultSession.webRequest.onCompleted(async (details) => {
      //console.log(details)
      var url = details.url

      const hostname = new URL(url).hostname
      console.log(url)

      const credentials = this.credentialsData[hostname]

      if (credentials && this.previousHostname !== hostname) {
        this.previousHostname = hostname
        this.logger.info(`Try to fill credentials for hostname: ${hostname}`)
        await delay(500)
        if (!(await this.fillCredentials(hostname, credentials))) {
          await delay(1000)
          if (!(await this.fillCredentials(hostname, credentials))) {
            this.logger.info(`Could not fill credentials for hostname: ${hostname}`)
          }
        }
      }
    })

    this.webContents.on("will-navigate", async () => {
      console.log("clear")
      this.previousHostname = null
    })
  }

  async fillCredentials(hostname, { password, username }) {
    if (await this.fillInput(hostname, username)) {
      await delay(100) // wait due to async input event processing
      return await this.fillInput(hostname, password)
    }

    return false
  }

  async fillInput(hostname, { selector, value }) {
    if (await this.focus(hostname, selector)) {
      this.typeWord(value)
      return true
    }

    return false
  }

  async focus(hostname, selector) {
    const cmd = `${getElementCenter.toString()};getElementCenter("${hostname}", "${selector}");`
    const center = await this.webContents.executeJavaScript(cmd, false)

    if (center) {
      this.webContents.sendInputEvent({
        type: "mouseDown",
        button: "left",
        x: center[0],
        y: center[1],
      })
      return true
    } else {
      return false
    }
  }

  typeWord(text) {
    for (const char of text) {
      this.webContents.sendInputEvent({ keyCode: char, type: "char" })
    }
  }
}

function getElementCenter(hostname, selector, root = document, parentOffset = [0, 0]) {
  const iframes = root.getElementsByTagName("iframe")
  for (const iframe of iframes) {
    const iframeOffset = [
      parentOffset[0] + iframe.getBoundingClientRect().left,
      parentOffset[1] + iframe.getBoundingClientRect().top,
    ]

    const iframeHostname = new URL(iframe.getAttribute("src")).hostname

    if (iframeHostname === hostname) {
      const element = iframe.contentDocument.querySelector(selector)

      if (element) {
        const { left, right, top, bottom } = element.getBoundingClientRect()
        return [(left + right) / 2 + iframeOffset[0], (top + bottom) / 2 + iframeOffset[1]]
      } else {
        return null
      }
    } else {
      return getElementCenter(hostname, selector, iframe.contentDocument, iframeOffset)
    }
  }
  return null
}

module.exports.loadCredentials = async (httpBrokerUri) => {
  try {
    const { data } = await axios.post(`${httpBrokerUri}/query`, { topic: "credentials", depth: -1 })

    return fromPairs(
      data.children
        .map(({ payload }) => JSON.parse(payload))
        .map(({ hostname, username, password }) => [hostname, { username, password }])
    )
  } catch (error) {
    /* ignore */
  }
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}
