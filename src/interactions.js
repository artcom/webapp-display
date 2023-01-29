const { session } = require("electron")
const fromPairs = require("lodash.frompairs")

const RETRY_ATTEMPTS = 20
const RETRY_TIMEOUT = 500

module.exports.WebpageInteractor = class WebpageInteractor {
  constructor(webContents, interactionData, logger) {
    this.webContents = webContents
    this.interactionData = interactionData
    this.logger = logger
  }

  async listen() {
    session.defaultSession.webRequest.onCompleted(async (details) => {
      const url = details.url.split("?")[0]

      const interactions = this.interactionData[url]

      if (interactions) {
        await delay(500)
        try {
          for (const interaction of interactions) {
            if (interaction.input) {
              this.logger.info(`Try to fill element ${interaction.selector}`)

              for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
                if (await this.fillCredential(url, interaction)) {
                  this.logger.info(`Filled: ${interaction.selector}`)
                  break
                }
                await delay(RETRY_TIMEOUT)
              }
            } else {
              this.logger.info(`Try to click element ${interaction.selector}`)

              for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
                if (await this.clickOn(url, interaction.selector)) {
                  this.logger.info(`Clicked: ${interaction.selector}`)
                  break
                }
                await delay(RETRY_TIMEOUT)
              }
            }
          }
          this.logger.info(`Did all interactions`)
        } catch (error) {
          this.logger.info(`Could not perform all interactions because: ${error}`)
        }
      }
    })
  }

  async fillCredential(url, interaction) {
    if (await this.fillInput(url, interaction)) {
      await delay(100)
      return true
    }

    return false
  }

  async fillInput(url, { selector, input }) {
    if (await this.clickOn(url, selector)) {
      this.typeWord(input)
      return true
    }

    return false
  }

  async clickOn(url, selector) {
    const cmd = `${getElementCenter.toString()};getElementCenter("${url}", "${selector}");`
    const center = await this.webContents.executeJavaScript(cmd, false)

    if (center) {
      const options = { button: "left", x: center[0], y: center[1], clickCount: 1 }

      this.webContents.sendInputEvent({
        type: "mouseDown",
        ...options,
      })
      this.webContents.sendInputEvent({
        type: "mouseUp",
        ...options,
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

    const iframeUrl = iframe.getAttribute("src").split("?")[0]

    if (iframeUrl === url) {
      const element = iframe.contentDocument.querySelector(selector)

      if (element) {
        const { left, right, top, bottom } = element.getBoundingClientRect()
        return [(left + right) / 2 + iframeOffset[0], (top + bottom) / 2 + iframeOffset[1]]
      } else {
        return null
      }
    }
  }
  return null
}

module.exports.loadInteractions = async (configServerUri, queryConfig) => {
  try {
    const data = await queryConfig(`services/webappDisplay/interactions`)

    return fromPairs(data.map(({ url, interactions }) => [url, interactions]))
  } catch (error) {
    /* ignore */
  }
}

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}
