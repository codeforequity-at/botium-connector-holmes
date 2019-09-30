const util = require('util')
const debug = require('debug')('botium-connector-holmes')

const SimpleRestContainer = require('botium-core/src/containers/plugins/SimpleRestContainer')
const CoreCapabilities = require('botium-core/src/Capabilities')

const Capabilities = {
  HOLMES_URL: 'HOLMES_URL',
  HOLMES_SERVICE_URL: 'HOLMES_SERVICE_URL',
  HOLMES_USER: 'HOLMES_USER',
  HOLMES_USER_ID: 'HOLMES_USER_ID',
  HOLMES_CHANNEL: 'HOLMES_CHANNEL'
}

class BotiumConnectorHolmes {
  constructor ({ queueBotSays, caps }) {
    this.queueBotSays = queueBotSays
    this.caps = caps
    this.delegateContainer = null
    this.delegateCaps = null
  }

  Validate () {
    debug('Validate called')

    if (!this.caps[Capabilities.HOLMES_URL]) throw new Error('HOLMES_URL capability required')

    if (!this.delegateContainer) {
      this.delegateCaps = {
        [CoreCapabilities.SIMPLEREST_URL]: this.caps[Capabilities.HOLMES_URL],
        [CoreCapabilities.SIMPLEREST_METHOD]: 'POST',
        [CoreCapabilities.SIMPLEREST_CONVERSATION_ID_TEMPLATE]: '{{#fnc.random}}7{{/fnc.random}}',
        [CoreCapabilities.SIMPLEREST_STEP_ID_TEMPLATE]: '{{#fnc.random}}5{{/fnc.random}}',
        [CoreCapabilities.SIMPLEREST_BODY_TEMPLATE]:
          `{ 
            "type": "direct",
            "timestamp": "{{fnc.now_DE}}",
            "service_url": "${this.caps[Capabilities.HOLMES_SERVICE_URL] || this.caps[Capabilities.HOLMES_URL]}",
            "channel": ${JSON.stringify(
              this.caps[Capabilities.HOLMES_CHANNEL] || { id: '1', type: 'web', lang: 'en' }
              )},
            "user": {
              "name": "${this.caps[Capabilities.HOLMES_USER] || 'user'}",
              "id": "${this.caps[Capabilities.HOLMES_USER_ID] || 'user@wipro.com'}",
              "session_id": "{{botium.conversationId}}"
            },
            "content": {
              "type": "text",
              "text": "{{msg.messageText}}",
              "message_id":  "{{botium.stepId}}",
              "attachments": [
              ]
            },
            "vars": {}           
          }`,
        [CoreCapabilities.SIMPLEREST_RESPONSE_JSONPATH]: '$.text',
        [CoreCapabilities.SIMPLEREST_BUTTONS_JSONPATH]: '$.attachments[?(@.type=="button")].data'
      }
      debug(`Validate delegateCaps ${util.inspect(this.delegateCaps)}`)
      this.delegateContainer = new SimpleRestContainer({ queueBotSays: this.queueBotSays, caps: this.delegateCaps })
    }

    debug('Validate delegate')
    this.delegateContainer.Validate()

    // SimpleRestContainer is synch
    return Promise.resolve()
  }

  Build () {
    if (this.delegateContainer.Build) {
      this.delegateContainer.Build()
    }

    debug('Build called')
    return Promise.resolve()
  }

  Start () {
    debug('Start called')

    if (this.delegateContainer.Start) {
      this.delegateContainer.Start()
    }

    return Promise.resolve()
  }

  UserSays (msg) {
    debug('UserSays called')
    return this.delegateContainer.UserSays(msg)
  }

  Stop () {
    debug('Stop called')

    if (this.delegateContainer.Stop) {
      this.delegateContainer.Stop()
    }

    return Promise.resolve()
  }

  Clean () {
    debug('Clean called')
    if (this.delegateContainer.Clean) {
      this.delegateContainer.Clean()
    }

    return Promise.resolve()
  }
}

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorHolmes
}
