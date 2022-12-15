const axios = require("axios")
const fromPairs = require("lodash.frompairs")

module.exports.CredentialsFiller = class CredentialsFiller {
  constructor(webContents, credentialsData, logger) {
    this.webContents = webContents
    this.credentialsData = credentialsData
    this.logger = logger
  }

  async listen() {
    this.webContents.on("did-start-navigation", async (event, baseUrl) => {
      const url = baseUrl.split("?")[0]

      const credentials = this.credentialsData[url]
      if (credentials) {
        console.log(`Try to fill credentials for url: ${url}`)
        await delay(1500)
        if (!(await this.fillCredentials(url, credentials))) {
          if (!(await this.fillCredentials(url, credentials))) {
            console.log(`Could not fill credentials for url: ${url}`)
          }
        }
      }
    })
  }

  async fillCredentials(url, { password, username }) {
    if (await this.fillInput(url, username)) {
      await delay(100) // wait due to async input event processing
      return await this.fillInput(url, password)
    }

    return false
  }

  async fillInput(url, { selector, value }) {
    if (await this.focus(url, selector)) {
      this.typeWord(value)
      return true
    }

    return false
  }

  async focus(url, selector) {
    const cmd = `${getElementCenter.toString()};getElementCenter("${url}", "${selector}");`
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

function getElementCenter(url, selector, root = document, parentOffset = [0, 0]) {
  const iframes = root.getElementsByTagName("iframe")
  for (const iframe of iframes) {
    const iframeOffset = [
      parentOffset[0] + iframe.getBoundingClientRect().left,
      parentOffset[1] + iframe.getBoundingClientRect().top,
    ]

    if (iframe.getAttribute("src").includes(url)) {
      const element = iframe.contentDocument.querySelector(selector)

      if (element) {
        const { left, right, top, bottom } = element.getBoundingClientRect()
        return [(left + right) / 2 + iframeOffset[0], (top + bottom) / 2 + iframeOffset[1]]
      } else {
        return null
      }
    } else {
      return getElementCenter(url, selector, iframe.contentDocument, iframeOffset)
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
        .map(({ url, username, password }) => [url, { username, password }])
    )
  } catch (error) {
    /* ignore */
  }
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}
