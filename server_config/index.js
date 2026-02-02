var convict = require('convict')
convict.addFormat(require('convict-format-with-validator').ipaddress)
convict.addFormat(require('convict-format-with-validator').url)
const path = require('path')
const fs = require('fs')

// Define a schema
let config = convict({
  environment: {
    doc: 'The application environment.',
    format: ['production', 'development'],
    default: 'development',
    env: 'APP_ENV',
    arg: 'environment'
  },
  region: {
    doc: 'The region in which the application is being run.',
    format: 'String',
    default: 'in',
    env: 'REGION',
    arg: 'region'
  },
  logLevel: {
    doc: 'Custom debug level configuration',
    format: 'String',
    default: 'debug',
    arg: 'logLevel'
  }
})
let { REGION = 'in', APP_ENV = 'development' } = process.env
let configFilePath = path.join(__dirname, `/${REGION}/${APP_ENV}.json`)
try {
  if (fs.existsSync(configFilePath)) {
    config.loadFile([configFilePath])
  }
} catch (err) {
  console.warn(`No configuration file found for ${REGION} ${APP_ENV}`)
}
// Perform validation
config.validate({ allowed: 'strict' })

module.exports = config
