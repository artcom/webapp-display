const axios = require("axios")
const delay = require("delay")
const fromPairs = require("lodash.frompairs")

module.exports.CredentialsFiller = class CredentialsFiller {
  constructor(webContents, credentialsData) {
    this.webContents = webContents
    this.credentialsData = credentialsData
  }

  async listen() {
    this.webContents.on(
      "did-get-response-details",
      async (event, status, newURL, originalURL) => {
        const credentials = this.credentialsData[originalURL]
        if (credentials) {
          console.log(`Try to fill credentials for url: ${originalURL}`)
          await delay(200)
          if (!await this.fillCredentials(originalURL, credentials)) {
            await delay(1000)
            await this.fillCredentials(originalURL, credentials)
          }
        }
      }
    )
  }

  async fillCredentials(url, { password, username }) {
    if (await this.fillInput(url, username)) {
      await delay(100) // wait due to async input event processing
      return await this.fillInput(url, password)
    }

    return false
  }

  async fillInput(url, { selector, value }) {
    if (await this.focusAndClearInput(url, selector)) {
      this.typeWord(value)
      return true
    }

    return false
  }

  async focusAndClearInput(url, selector) {
    return new Promise(resolve => {
      this.webContents.executeJavaScript(
        `${focusElement.toString()};focusElement("${url}", "${selector}");`,
        false,
        result => resolve(result)
      )
    })
  }

  typeWord(text) {
    for (const char of text) {
      this.webContents.sendInputEvent({ keyCode: char, type: "char" })
    }
  }
}

function focusElement(url, selector, root = document) {
  const iframes = root.getElementsByTagName("iframe")
  for (const iframe of iframes) {
    if (iframe.getAttribute("src") === url) {
      const element = iframe.contentDocument.querySelector(selector)
      if (element) {
        element.value = ""
        element.focus()
        return true
      }
    } else {
      if (focusElement(url, selector, iframe.contentDocument)) {
        return true
      }
    }
  }
  return false
}

module.exports.loadCredentials = async (httpBrokerUri) => {
  const { data } = await axios.post(`${httpBrokerUri}/query`, { topic: "credentials", depth: -1 })

  return fromPairs(data.children
    .map(({ payload }) => JSON.parse(payload))
    .map(({ url, username, password }) => [url, { username, password }])
  )
}

