const fromPairs = require("lodash.frompairs")
const { delay } = require("./utils")

const RETRY_ATTEMPTS = 20
const RETRY_TIMEOUT = 500

module.exports.WebpageInteractor = class WebpageInteractor {
  constructor(webContents, interactionData, logger) {
    this.webContents = webContents
    this.interactionData = interactionData
    this.logger = logger
  }

  async listen() {
    this.webContents.session.webRequest.onCompleted(async (details) => {
      const url = details.url.split("?")[0]

      const interactions = this.interactionData[url]

      if (interactions) {
        try {
          for (const interaction of interactions) {
            await delay(interaction.delay || 0)

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
                if (await this.clickOn(url, interaction.selector, interaction.index)) {
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
    const cmd = `${deepQuerySelectorAll.toString()};${setInputValue.toString()};setInputValue(${JSON.stringify(
      url
    )}, ${JSON.stringify(selector)}, ${JSON.stringify(input)});`
    const filled = await this.webContents.executeJavaScript(cmd, false)
    if (filled) {
      this.logger.info(`Filled ${selector} with: ${input.substring(0, 3)}...`)
      return true
    }

    this.logger.info(`Failed to fill ${selector}`)
    return false
  }

  async clickOn(url, selector, index = 0) {
    const cmd = `${deepQuerySelectorAll.toString()};${getElementCenter.toString()};getElementCenter(${JSON.stringify(
      url
    )}, ${JSON.stringify(selector)}, ${JSON.stringify(index)});`
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
      this.logger.info(
        `clickOn(${url}, ${selector}) did not find element: ${JSON.stringify(center)}`
      )
      return false
    }
  }
}

function deepQuerySelectorAll(root, selector) {
  const results = [...root.querySelectorAll(selector)]

  const all = root.querySelectorAll("*")
  for (const el of all) {
    if (el.shadowRoot) {
      results.push(...deepQuerySelectorAll(el.shadowRoot, selector))
    }
  }

  return results
}

function setInputValue(url, selector, value) {
  if (document.location.href.split("?")[0] === url) {
    const stats = { shadowHosts: [] }
    const elements = deepQuerySelectorAll(document, selector, stats)
    const element = elements[0]

    if (element && element.tagName.match(/INPUT|TEXTAREA/i)) {
      element.value = value
      element.dispatchEvent(new Event("input", { bubbles: true }))
      element.dispatchEvent(new Event("change", { bubbles: true }))
      return true
    }
    return false
  }

  const iframes = document.getElementsByTagName("iframe")
  for (const iframe of iframes) {
    let currentUrl
    try {
      currentUrl = iframe.contentWindow.location.href.split("?")[0]
    } catch (error) {
      currentUrl = iframe.getAttribute("src") ? iframe.getAttribute("src").split("?")[0] : null
    }

    if (currentUrl === url) {
      try {
        const stats = { shadowHosts: [] }
        const elements = deepQuerySelectorAll(iframe.contentDocument, selector, stats)
        const element = elements[0]

        if (element && element.tagName.match(/INPUT|TEXTAREA/i)) {
          element.value = value
          element.dispatchEvent(new Event("input", { bubbles: true }))
          element.dispatchEvent(new Event("change", { bubbles: true }))
          return true
        }
      } catch (error) {
        return false
      }
    }
  }
  return false
}

function getElementCenter(url, selector, index, root = document, parentOffset = [0, 0]) {
  const iframes = root.getElementsByTagName("iframe")
  for (const iframe of iframes) {
    const iframeOffset = [
      parentOffset[0] + iframe.getBoundingClientRect().left,
      parentOffset[1] + iframe.getBoundingClientRect().top,
    ]

    const iframeUrl = iframe.getAttribute("src").split("?")[0]

    if (iframeUrl === url) {
      const elements = deepQuerySelectorAll(iframe.contentDocument, selector)
      const element = elements[index]

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
