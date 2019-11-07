const util = require('util')
const url = require('url')
const mime = require('mime-types')
const _ = require('lodash')
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

const Defaults = {
  [Capabilities.HOLMES_CHANNEL]: { id: '1', type: 'web', lang: 'en' }
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

    Object.assign(this.caps, Defaults)

    if (!this.caps[Capabilities.HOLMES_URL]) throw new Error('HOLMES_URL capability required')
    const holmesURL = url.parse(this.caps[Capabilities.HOLMES_URL])

    if (!this.delegateContainer) {
      this.delegateCaps = {
        [CoreCapabilities.SIMPLEREST_URL]: this.caps[Capabilities.HOLMES_URL],
        [CoreCapabilities.SIMPLEREST_PING_URL]: `${holmesURL.protocol}//${holmesURL.host}`,
        [CoreCapabilities.SIMPLEREST_METHOD]: 'POST',
        [CoreCapabilities.SIMPLEREST_CONVERSATION_ID_TEMPLATE]: '{{#fnc.random}}7{{/fnc.random}}',
        [CoreCapabilities.SIMPLEREST_STEP_ID_TEMPLATE]: '{{#fnc.random}}5{{/fnc.random}}',
        [CoreCapabilities.SIMPLEREST_BODY_TEMPLATE]:
          `{
            "type": "direct",
            "timestamp": "{{fnc.date_ISO}} {{fnc.time_ISO}}",
            "service_url": "${this.caps[Capabilities.HOLMES_SERVICE_URL] || this.caps[Capabilities.HOLMES_URL]}",
            "channel": ${_.isString(this.caps[Capabilities.HOLMES_CHANNEL]) ? this.caps[Capabilities.HOLMES_CHANNEL] : JSON.stringify(this.caps[Capabilities.HOLMES_CHANNEL])},
            "user": {
              "name": "${this.caps[Capabilities.HOLMES_USER] || 'user'}",
              "id": "${this.caps[Capabilities.HOLMES_USER_ID] || 'user@wipro.com'}",
              "session_id": "{{botium.conversationId}}"
            },
            "content": {
              "type": "text",
              "text": "{{msg.messageText}}",
              "message_id":  "{{botium.stepId}}",
              {{#msg.forms}}
                "{{name}}": "{{value}}",
              {{/msg.forms}}              
              "attachments": [
              ]
            },
            "vars": {
            }           
          }`,
        [Capabilities.SIMPLEREST_REQUEST_HOOK]: () => {},
        [CoreCapabilities.SIMPLEREST_RESPONSE_JSONPATH]: '$.text',
        [CoreCapabilities.SIMPLEREST_RESPONSE_HOOK]: ({ botMsg }) => {
          botMsg.nlp = { }
          if (botMsg.sourceData.trace && botMsg.sourceData.trace.intent && Object.keys(botMsg.sourceData.trace.intent).length > 0) {
            botMsg.nlp.intent = {
              intents: []
            }
            for (const intent of Object.keys(botMsg.sourceData.trace.intent)) {
              botMsg.nlp.intent.intents.push({ name: intent, confidence: botMsg.sourceData.trace.intent[intent]})
            }
            if (botMsg.nlp.intent.intents.length > 0) {
              Object.assign(botMsg.nlp.intent, _.maxBy(botMsg.nlp.intent.intents, i => i.confidence))
            }
          }
          
          const mapButton = (b) => ({
            text: _.isString(b) ? b : b.title || b.text || b.label,
            payload: !_.isString(b) && JSON.stringify(b.value || b.url || b.data),
            imageUri: !_.isString(b) && b.image || b.iconUrl
          })
          const mapImage = (i) => ({
            mediaUri: i.url,
            mimeType: mime.lookup(i.url) || 'application/unknown',
            altText: i.alt || i.altText
          })
          const mapMedia = (m) => ({
            mediaUri: _.isString(m) ? m : m.url,
            mimeType: (_.isString(m) ? mime.lookup(m) : mime.lookup(m.url)) || 'application/unknown',
            altText: !_.isString(m) && m.profile
          })
          const mapCard = (c) => ({
            text: c.title,
            content: c.description,
            media: c.image_url && mapMedia(c.image_url),
            buttons: c.button && [ mapButton(c.button) ]
          })
          
          const mapAdaptiveCard = (a) => {
            const textBlocks = this._deepFilter(a.content.body, (t) => t.type, (t) => t.type === 'TextBlock')
            const imageBlocks = this._deepFilter(a.content.body, (t) => t.type, (t) => t.type === 'Image')
            const buttonBlocks = this._deepFilter(a.content.body, (t) => t.type, (t) => t.type.startsWith('Action.'))
            const choiceBlocks = this._deepFilter(a.content.body, (t) => t.type, (t) => t.type === 'Input.ChoiceSet')

            return {
              text: ((textBlocks && textBlocks.map(t => t.text)) || []).concat((choiceBlocks && choiceBlocks.reduce((agg, cb) => agg.concat(cb.choices.map(c => c.title)), [])) || []),
              image: imageBlocks && imageBlocks.length > 0 && mapImage(imageBlocks[0]),
              buttons: ((a.content.actions && a.content.actions.map(mapButton)) || []).concat((buttonBlocks && buttonBlocks.map(mapButton)) || [])
            }
          }
          
          botMsg.buttons = botMsg.buttons || []
          botMsg.media = botMsg.media || []
          botMsg.cards = botMsg.cards || []
          if (_.isArray(botMsg.sourceData.attachments) && botMsg.sourceData.attachments.length > 0) {
            for (const attachment of botMsg.sourceData.attachments) {
              if (attachment.media_type === 'image') {
                botMsg.media.push(mapImage(attachment.media_url))
              }
              if (attachment.type === 'button' || attachment.type === 'list') {
                if (attachment.data && attachment.data.length > 0) {
                  attachment.data.forEach(b => {
                    botMsg.buttons.push(mapButton(b))
                  })
                }
                if (attachment.options && attachment.options.length > 0) {
                  attachment.options.forEach(b => {
                    botMsg.buttons.push(mapButton(b))
                  })
                }
              }
              if (attachment.type === 'AdaptiveCard') {
                botMsg.cards.push(mapAdaptiveCard(attachment.data[0]))
              }
              if (attachment.type === 'carousel') {
                if (attachment.data && attachment.data.length > 0) {
                  for (const d of attachment.data) {
                    if (d.contentType === 'application/vnd.microsoft.card.adaptive') {
                      botMsg.cards.push(mapAdaptiveCard(d))
                    }
                  }
                }
                if (attachment.elements && attachment.elements.length > 0) {
                  for (const e of attachment.elements) {
                    botMsg.cards.push(mapCard(e))
                  }
                }
              }
            }
          }
        }       
     
      }
      debug(`Validate delegateCaps ${util.inspect(this.delegateCaps)}`)
      this.delegateContainer = new SimpleRestContainer({ queueBotSays: this.queueBotSays, caps: this.delegateCaps })
    }

    debug('Validate delegate')
    return this.delegateContainer.Validate()
  }

  _deepFilter (item, selectFn, filterFn) {
    let result = []
    if (_.isArray(item)) {
      item.filter(selectFn).forEach(subItem => {
        result = result.concat(this._deepFilter(subItem, selectFn, filterFn))
      })
    } else if (selectFn(item)) {
      if (filterFn(item)) {
        result.push(item)
      } else {
        Object.getOwnPropertyNames(item).forEach(key => {
          result = result.concat(this._deepFilter(item[key], selectFn, filterFn))
        })
      }
    }
    return result
  }

  Build () {
    return this.delegateContainer.Build()
  }

  Start () {
    return this.delegateContainer.Start()
  }

  UserSays (msg) {
    return this.delegateContainer.UserSays(msg)
  }

  Stop () {
    return this.delegateContainer.Stop()
  }

  Clean () {
    return this.delegateContainer.Clean()
  }
}

module.exports = {
  PluginVersion: 1,
  PluginClass: BotiumConnectorHolmes
}
