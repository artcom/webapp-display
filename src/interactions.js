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

      const testInteractionData = {
        "https://my.fuerstenberg-institut.de/en/login/": [
          {
            selector: '[data-testid="uc-accept-all-button"]',
          },
          {
            delay: 500,
            selector: "[type=email]",
            input: "m.reuter@telekom.de",
          },
          {
            selector: "[type=password]",
            input: "Technologie_02",
          },
          {
            selector: "[type=submit]",
          },
        ],
      }

      const interactions = testInteractionData[url]

      if (!interactions) return

      try {
        for (const interaction of interactions) {
          await delay(interaction.delay || 0)

          if (interaction.input) {
            await this.performInputFillWithRetry(url, interaction)
          } else {
            await this.performClickWithRetry(url, interaction)
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
          this.logger.info(`Skipped: element ${interaction.selector} not found after ${maxNotFoundAttempts} attempts`)
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
          this.logger.info(`Skipped: element ${interaction.selector} not found after ${maxNotFoundAttempts} attempts`)
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
      ${findElementsInDomTree.toString()};
      ${setInputValue.toString()};
      ${getElementCenter.toString()};
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

function setInputValue(targetUrl, elementSelector, inputValue) {
  const currentPageUrl = document.location.href.split("?")[0]

  if (currentPageUrl === targetUrl) {
    const matchedElements = findElementsInDomTree(document, elementSelector)
    const targetElement = matchedElements[0]

    if (targetElement && targetElement.tagName.match(/INPUT|TEXTAREA/i)) {
      targetElement.value = inputValue
      targetElement.dispatchEvent(new Event("input", { bubbles: true }))
      targetElement.dispatchEvent(new Event("change", { bubbles: true }))
      return true
    }
    return "not-found"
  }

  const pageIframes = document.getElementsByTagName("iframe")
  for (const iframe of pageIframes) {
    let iframeUrl
    try {
      iframeUrl = iframe.contentWindow.location.href.split("?")[0]
    } catch (error) {
      iframeUrl = iframe.getAttribute("src") ? iframe.getAttribute("src").split("?")[0] : null
    }

    if (iframeUrl === targetUrl) {
      try {
        const matchedElements = findElementsInDomTree(iframe.contentDocument, elementSelector)
        const targetElement = matchedElements[0]

        if (targetElement && targetElement.tagName.match(/INPUT|TEXTAREA/i)) {
          targetElement.value = inputValue
          targetElement.dispatchEvent(new Event("input", { bubbles: true }))
          targetElement.dispatchEvent(new Event("change", { bubbles: true }))
          return true
        }
      } catch (error) {
        return false
      }
    }
  }
  return "not-found"
}

function getElementCenter(
  targetUrl,
  elementSelector,
  elementIndex,
  rootElement = document,
  parentOffset = [0, 0]
) {
  const pageIframes = rootElement.getElementsByTagName("iframe")

  for (const iframe of pageIframes) {
    const iframeOffsetFromParent = [
      parentOffset[0] + iframe.getBoundingClientRect().left,
      parentOffset[1] + iframe.getBoundingClientRect().top,
    ]

    const iframeUrl = iframe.getAttribute("src").split("?")[0]

    if (iframeUrl === targetUrl) {
      const matchedElements = findElementsInDomTree(iframe.contentDocument, elementSelector)
      const targetElement = matchedElements[elementIndex]

      if (targetElement) {
        const { left, right, top, bottom } = targetElement.getBoundingClientRect()
        const centerX = (left + right) / 2 + iframeOffsetFromParent[0]
        const centerY = (top + bottom) / 2 + iframeOffsetFromParent[1]
        return [centerX, centerY]
      } else {
        return "not-found"
      }
    }
  }

  return "not-found"
}

function clickElement(targetUrl, elementSelector, elementIndex) {
  const currentPageUrl = document.location.href.split("?")[0]

  if (currentPageUrl === targetUrl) {
    const matchedElements = findElementsInDomTree(document, elementSelector)
    const targetElement = matchedElements[elementIndex]

    if (targetElement) {
      targetElement.click()
      return true
    }
    return "not-found"
  }

  const pageIframes = document.getElementsByTagName("iframe")
  for (const iframe of pageIframes) {
    let iframeUrl
    try {
      iframeUrl = iframe.contentWindow.location.href.split("?")[0]
    } catch (error) {
      iframeUrl = iframe.getAttribute("src") ? iframe.getAttribute("src").split("?")[0] : null
    }

    if (iframeUrl === targetUrl) {
      try {
        const matchedElements = findElementsInDomTree(iframe.contentDocument, elementSelector)
        const targetElement = matchedElements[elementIndex]

        if (targetElement) {
          targetElement.click()
          return true
        }
      } catch (error) {
        return false
      }
    }
  }
  return "not-found"
}

module.exports.loadInteractions = async (configServerUri, queryConfig) => {
  try {
    const data = await queryConfig(`services/webappDisplay/interactions`)

    return fromPairs(data.map(({ url, interactions }) => [url, interactions]))
  } catch (error) {
    /* ignore */
  }
}
