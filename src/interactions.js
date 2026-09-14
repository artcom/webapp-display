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
      const url = normalizeUrl(details.url)

      const interactions = this.interactionData[url]
      if (!interactions) return

      await delay(500)

      let liveUrl = null
      try {
        liveUrl = await this.webContents.executeJavaScript(`
          (() => {
            const iframe = document.querySelector("iframe")
            return iframe ? iframe.contentWindow.location.href : document.location.href
          })()
        `)
      } catch (error) {
        // cross-origin iframe or no page yet - fall back to the request url
      }

      const targetUrl = normalizeUrl(liveUrl) || url
      this.logger.info(`Interactions for ${url} (target: ${targetUrl})`)

      try {
        for (const interaction of interactions) {
          await delay(interaction.delay || 0)

          if (interaction.input) {
            await this.performInputFillWithRetry(targetUrl, interaction)
          } else {
            await this.performClickWithRetry(targetUrl, interaction)
          }
        }
        this.logger.info(`Did all interactions`)
      } catch (error) {
        this.logger.info(`Could not perform all interactions because: ${error}`)
      }
    })
  }

  async performInputFillWithRetry(url, interaction) {
    this.logger.info(`Try to fill element ${interaction.selector}`)

    let notFoundCount = 0
    const maxNotFoundAttempts = 5

    for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
      const result = await this.fillInput(url, interaction)

      if (result === true) {
        this.logger.info(`Filled: ${interaction.selector}`)
        return
      }

      if (result === "not-found") {
        notFoundCount++
        if (notFoundCount >= maxNotFoundAttempts) {
          this.logger.info(
            `Skipped: element ${interaction.selector} not found after ${maxNotFoundAttempts} attempts`
          )
          return
        }
      }

      await delay(RETRY_TIMEOUT)
    }
  }

  async performClickWithRetry(url, interaction) {
    this.logger.info(`Try to click element ${interaction.selector}`)

    let notFoundCount = 0
    const maxNotFoundAttempts = 5

    for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
      const result = await this.clickOn(url, interaction.selector, interaction.index)

      if (result === true) {
        this.logger.info(`Clicked: ${interaction.selector}`)
        return
      }

      if (result === "not-found") {
        notFoundCount++
        if (notFoundCount >= maxNotFoundAttempts) {
          this.logger.info(
            `Skipped: element ${interaction.selector} not found after ${maxNotFoundAttempts} attempts`
          )
          return
        }
      }

      await delay(RETRY_TIMEOUT)
    }
  }

  async fillInput(url, { selector, input }) {
    const result = await this.executeInBrowserContext("setInputValue", url, selector, input)

    if (result === true) {
      this.logger.info(`Filled ${selector} with: ${input.substring(0, 3)}...`)
      return true
    }

    if (result === "not-found") {
      return "not-found"
    }

    return false
  }

  async clickOn(url, selector, index = 0) {
    const result = await this.executeInBrowserContext("clickElement", url, selector, index)

    if (result === true) {
      return true
    }

    return "not-found"
  }

  executeInBrowserContext(functionName, ...functionArguments) {
    const serializedArguments = functionArguments
      .map((argument) => JSON.stringify(argument))
      .join(", ")

    const helperFunctions = `
      ${normalizeUrl.toString()};
      ${findElementsInDomTree.toString()};
      ${findDocumentForUrl.toString()};
      ${setNativeValue.toString()};
      ${setInputValue.toString()};
      ${clickElement.toString()};
    `

    const javascriptCode = `${helperFunctions}${functionName}(${serializedArguments});`

    return this.webContents.executeJavaScript(javascriptCode, false)
  }
}

// ============================================================================
// Browser-side functions (executed in renderer process via Electron)
// ============================================================================

function findElementsInDomTree(rootElement, elementSelector) {
  const matchedElements = [...rootElement.querySelectorAll(elementSelector)]

  const allElements = rootElement.querySelectorAll("*")
  for (const currentElement of allElements) {
    if (currentElement.shadowRoot) {
      matchedElements.push(...findElementsInDomTree(currentElement.shadowRoot, elementSelector))
    }
  }

  return matchedElements
}

function normalizeUrl(url) {
  return url ? url.split("?")[0].replace(/\/$/, "") : null
}

function setNativeValue(element, value) {
  const { set } = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value")
  set.call(element, value)

  element.dispatchEvent(new Event("input", { bubbles: true }))
  element.dispatchEvent(new Event("change", { bubbles: true }))
}

function findDocumentForUrl(targetUrl) {
  if (normalizeUrl(document.location.href) === targetUrl) {
    return document
  }

  for (const iframe of document.getElementsByTagName("iframe")) {
    let iframeUrl
    try {
      iframeUrl = normalizeUrl(iframe.contentWindow.location.href)
    } catch (error) {
      iframeUrl = normalizeUrl(iframe.getAttribute("src"))
    }

    if (iframeUrl === targetUrl) {
      return iframe.contentDocument
    }
  }

  return null
}

function setInputValue(targetUrl, elementSelector, inputValue) {
  const targetDocument = findDocumentForUrl(targetUrl)
  if (!targetDocument) {
    return "not-found"
  }

  const targetElement = findElementsInDomTree(targetDocument, elementSelector)[0]
  if (!targetElement || !targetElement.tagName.match(/INPUT|TEXTAREA/i)) {
    return "not-found"
  }

  setNativeValue(targetElement, inputValue)
  return true
}

function clickElement(targetUrl, elementSelector, elementIndex) {
  const targetDocument = findDocumentForUrl(targetUrl)
  if (!targetDocument) {
    return "not-found"
  }

  const targetElement = findElementsInDomTree(targetDocument, elementSelector)[elementIndex]
  if (!targetElement) {
    return "not-found"
  }

  targetElement.click()
  return true
}

module.exports.loadInteractions = async (configServerUri, queryConfig) => {
  try {
    const data = await queryConfig(`services/webappDisplay/interactions`)
    return fromPairs(data.map(({ url, interactions }) => [normalizeUrl(url), interactions]))
  } catch (error) {
    /* ignore */
  }
}
