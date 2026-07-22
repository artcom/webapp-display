const fromPairs = require("lodash.frompairs")

function toMap(entries) {
  return fromPairs((entries || []).map(({ host, username, password }) => [host, { username, password }]))
}

module.exports.loadHttpAuth = async (queryConfig, localHttpAuth) => {
  let serverEntries = []
  try {
    serverEntries = await queryConfig(`services/webappDisplay/httpAuth`)
  } catch (error) {
    /* ignore - no http auth configured on the config server */
  }

  return { ...toMap(serverEntries), ...toMap(localHttpAuth) }
}

module.exports.installHttpAuthHeaders = (session, credentialsByHost, logger) => {
  const basicHeaderByHost = {}
  Object.entries(credentialsByHost).forEach(([host, { username, password }]) => {
    basicHeaderByHost[host] = "Basic " + Buffer.from(`${username}:${password}`).toString("base64")
  })

  const hosts = Object.keys(basicHeaderByHost)
  if (hosts.length === 0) {
    return
  }
  logger.info(`Attaching Basic auth headers for hosts: ${hosts.join(", ")}`)

  session.webRequest.onBeforeSendHeaders((details, callback) => {
    try {
      const { host } = new URL(details.url)
      const header = basicHeaderByHost[host]
      if (header && !details.requestHeaders["Authorization"]) {
        details.requestHeaders["Authorization"] = header
      }
    } catch (error) {
      /* ignore malformed url */
    }
    callback({ requestHeaders: details.requestHeaders })
  })
}

module.exports.installHttpAuthHandler = (electronApp, credentialsByHost, logger) => {
  const answered = new Set()

  electronApp.on("login", (event, webContents, details, authInfo, callback) => {
    if (authInfo.isProxy) {
      return
    }

    const credentials = credentialsByHost[authInfo.host]
    if (!credentials) {
      logger.warn(`No HTTP auth credentials configured for host "${authInfo.host}"`)
      return
    }

    const key = `${details.url} ${authInfo.realm}`
    if (answered.has(key)) {
      answered.delete(key)
      logger.warn(
        `HTTP auth credentials rejected for "${authInfo.host}" (realm "${authInfo.realm}", ${details.url}) - not retrying`
      )
      event.preventDefault()
      callback() // cancel: surface the 401 instead of looping
      return
    }

    answered.add(key)
    logger.info(
      `Providing HTTP auth credentials for "${authInfo.host}" (realm "${authInfo.realm}", ${details.url})`
    )
    event.preventDefault()
    callback(credentials.username, credentials.password)
  })
}
