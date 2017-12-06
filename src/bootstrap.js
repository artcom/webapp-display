const axios = require("axios")
const delay = require("delay")

module.exports = function bootstrap(url) {
  return axios.get(url, { timeout: 2000 })
    .then(response => response.data)
    .catch(() => delay(1000).then(() => bootstrap(url)))
}
