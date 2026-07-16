const fromPairs = require("lodash.frompairs")

// Loads HTTP (Basic/Digest) auth credentials from the config server.
// Expected config at `services/webappDisplay/httpAuth`: an array of
// { host, username, password } entries, where `host` matches authInfo.host
// (e.g. "t-systems.dev-portal.senair.io" or "example.com:8080").
module.exports.loadHttpAuth = async (queryConfig) => {
  try {
    const data = await queryConfig(`services/webappDisplay/httpAuth`)
    return fromPairs(data.map(({ host, username, password }) => [host, { username, password }]))
  } catch (error) {
    /* ignore - no http auth configured */
    return {}
  }
}

// Installs an app-level handler that answers Chromium's native HTTP auth
// prompt with configured credentials instead of showing the dialog.
module.exports.installHttpAuthHandler = (electronApp, credentialsByHost, logger) => {
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

    logger.info(`Providing HTTP auth credentials for host "${authInfo.host}"`)
    event.preventDefault()
    callback(credentials.username, credentials.password)
  })
}
