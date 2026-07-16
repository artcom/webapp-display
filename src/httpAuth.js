const fromPairs = require("lodash.frompairs")

// Loads HTTP (Basic/Digest) auth credentials from the config server.
// Expected config at `services/webappDisplay/httpAuth`: an array of
// { host, username, password } entries, where `host` matches authInfo.host
// (e.g. "t-systems.dev-portal.senair.io" or "example.com:8080").
const toMap = (entries) =>
  fromPairs((entries || []).map(({ host, username, password }) => [host, { username, password }]))

module.exports.loadHttpAuth = async (queryConfig, localHttpAuth) => {
  let serverEntries = []
  try {
    serverEntries = await queryConfig(`services/webappDisplay/httpAuth`)
  } catch (error) {
    /* ignore - no http auth configured on the config server */
  }

  // Local config (config.json) overrides the config server, for local testing.
  return { ...toMap(serverEntries), ...toMap(localHttpAuth) }
}

// Preemptively attaches an `Authorization: Basic` header to every request
// whose host has configured credentials. This mirrors how a browser replays
// cached credentials after a single login, and avoids the 401/retry cycle
// that Electron's `login` event can trigger for XHR/fetch subresources
// (net::ERR_TOO_MANY_RETRIES). Basic auth only - Digest still relies on the
// `login` handler below, since it needs the server's challenge nonce.
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

// Installs an app-level handler that answers Chromium's native HTTP auth
// prompt with configured credentials instead of showing the dialog.
module.exports.installHttpAuthHandler = (electronApp, credentialsByHost, logger) => {
  // Tracks requests we have already answered. If the same request challenges
  // us again, the credentials were rejected - so we give up instead of
  // re-sending them, which would loop until net::ERR_TOO_MANY_RETRIES.
  const answered = new Set()

  electronApp.on("login", (event, webContents, details, authInfo, callback) => {
    // Let proxy authentication fall through to the default behaviour.
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
      // We already tried these credentials for this request and were rejected.
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
