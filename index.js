const util = require('util')
// const url = require('url')
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
  HOLMES_CHANNEL: 'HOLMES_CHANNEL',
  HOLMES_VARS: 'HOLMES_VARS'
}

const Defaults = {
  [Capabilities.HOLMES_CHANNEL]: { id: '1', type: 'web', lang: 'en' },
  [Capabilities.HOLMES_VARS]: {}
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

    this.caps = Object.assign({}, Defaults, this.caps)

    if (!this.caps[Capabilities.HOLMES_URL]) throw new Error('HOLMES_URL capability required')
    // const holmesURL = new url.URL(this.caps[Capabilities.HOLMES_URL])

    if (!this.delegateContainer) {
      this.delegateCaps = {
        [CoreCapabilities.SIMPLEREST_URL]: this.caps[Capabilities.HOLMES_URL],
        // [CoreCapabilities.SIMPLEREST_PING_URL]: `${holmesURL.protocol}//${holmesURL.host}`,
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
              "text": "{{#jsonStringify}}{{{msg.messageText}}}{{/jsonStringify}}",
              "message_id": "{{botium.stepId}}",
              "attachments": [
              ]
            },
            "vars": ${_.isString(this.caps[Capabilities.HOLMES_VARS]) ? this.caps[Capabilities.HOLMES_VARS] : JSON.stringify(this.caps[Capabilities.HOLMES_VARS])}
          }`,
        [CoreCapabilities.SIMPLEREST_REQUEST_HOOK]: ({ requestOptions, msg, context }) => {
          const buttonPayload = msg.buttons && msg.buttons.length > 0 && (msg.buttons[0].payload || msg.buttons[0].text)

          // Special handling for Feedback forms
          if (msg.forms && msg.forms.length > 0 && msg.forms.findIndex(f => f.name === 'submitFeedback' && f.value) >= 0) {
            requestOptions.body.vars = requestOptions.body.vars || {}
            requestOptions.body.vars.feedback = {
              msg: (msg.forms.find(f => f.name === 'msg') || { value: '' }).value,
              comment: (msg.forms.find(f => f.name === 'comment') || { value: '' }).value
            }
            requestOptions.body.content.text = requestOptions.body.vars.feedback.msg
          } else if (msg.forms && msg.forms.length > 0 && msg.forms.findIndex(f => f.name === 'skipForm' && f.value) < 0) {
            debug(`Found forms payload, adding to text (${JSON.stringify(msg.forms)})`)
            const content = {}
            if (buttonPayload) {
              if (_.isObject(buttonPayload)) Object.assign(content, buttonPayload)
              else content.text = buttonPayload
            }
            for (const f of msg.forms) {
              content[f.name] = f.value
            }
            requestOptions.body.content.text = JSON.stringify(content)
          } else if (buttonPayload) {
            debug(`Found button payload, adding to text (${JSON.stringify(buttonPayload)})`)
            if (_.isObject(buttonPayload)) {
              requestOptions.body.content.text = JSON.stringify(buttonPayload)
            } else {
              requestOptions.body.content.text = buttonPayload
            }
          }
          debug(`Request Body: ${JSON.stringify(requestOptions.body)}`)
        },
        [CoreCapabilities.SIMPLEREST_RESPONSE_JSONPATH]: ['$.text', '$.message'],
        [CoreCapabilities.SIMPLEREST_RESPONSE_HOOK]: ({ botMsg }) => {
          debug(`Response Body: ${JSON.stringify(botMsg.sourceData)}`)

          botMsg.nlp = { }
          if (botMsg.sourceData.trace && botMsg.sourceData.trace.intent && Object.keys(botMsg.sourceData.trace.intent).length > 0) {
            botMsg.nlp.intent = {
              intents: []
            }
            const sortedIntents = _.orderBy(Object.keys(botMsg.sourceData.trace.intent).map(intent => ({
              name: intent,
              confidence: botMsg.sourceData.trace.intent[intent]
            })), ['confidence'], ['desc'])

            Object.assign(botMsg.nlp.intent, sortedIntents[0])
            if (sortedIntents.length > 1) {
              botMsg.nlp.intent.intents = sortedIntents.slice(1)
            }
          }

          const mapButton = (b) => ({
            text: _.isString(b) ? b : b.title || b.text || b.label,
            payload: !_.isString(b) ? (b.value || b.url || b.data) : null,
            imageUri: !_.isString(b) ? (b.image || b.iconUrl) : null
          })
          const mapImage = (i) => ({
            mediaUri: i.url,
            mimeType: mime.lookup(i.url) || 'application/unknown',
            altText: i.alt || i.altText
          })
          const mapMedia = (m) => ({
            mediaUri: _.isString(m) ? m : m.url,
            mimeType: (_.isString(m) ? mime.lookup(m) : mime.lookup(m.url)) || 'application/unknown',
            altText: !_.isString(m) ? m.profile : false
          })
          const mapCard = (c) => ({
            text: c.title,
            content: c.content || c.description,
            media: c.image_url ? [mapMedia(c.image_url)] : null,
            buttons: c.button ? [mapButton(c.button)] : null
          })

          const mapAdaptiveCard = (a, title) => {
            const textBlocks = this._deepFilter(a.body, (t) => t.type, (t) => t.type === 'TextBlock')
            const imageBlocks = this._deepFilter(a.body, (t) => t.type, (t) => t.type === 'Image')
            const buttonBlocks = this._deepFilter(a.body, (t) => t.type, (t) => t.type.startsWith('Action.'))
            const actions = (a.actions || []).concat((buttonBlocks && buttonBlocks.map(mapButton)) || [])
            const subcards = actions.filter(action => (action.type === 'Action.ShowCard' && action.card)).map(action => mapAdaptiveCard(action.card, action.title))
            const inputs = this._deepFilter(a.body, (t) => t.type, (t) => t.type.startsWith('Input.'))
            const forms = []
            for (const input of inputs) {
              forms.push({
                name: input.id,
                label: input.label,
                type: input.type.substring('Input.'.length),
                options: input.choices
              })
            }

            const cards = [{
              text: title || '',
              content: textBlocks && textBlocks.map(t => t.text),
              image: imageBlocks && imageBlocks.length > 0 && mapImage(imageBlocks[0]),
              buttons: actions.map(mapButton),
              media: imageBlocks && imageBlocks.length > 1 && imageBlocks.slice(1).map(i => mapImage(i)),
              forms: forms.length ? forms : null,
              cards: subcards.length ? subcards : null,
              sourceData: { contentType: 'application/vnd.microsoft.card.adaptive', content: a }
            }]
            return cards
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
              if (attachment.type === 'AdaptiveCard' || attachment.type === 'AdaptiveCards') {
                if (attachment.data && attachment.data.length > 0) {
                  for (const d of attachment.data) {
                    if (d.contentType === 'application/vnd.microsoft.card.adaptive') {
                      botMsg.cards = botMsg.cards.concat(mapAdaptiveCard(d.content))
                    }
                  }
                }
              }
              if (attachment.type === 'carousel') {
                if (attachment.data && attachment.data.length > 0) {
                  for (const d of attachment.data) {
                    if (d.contentType === 'application/vnd.microsoft.card.adaptive') {
                      botMsg.cards = botMsg.cards.concat(mapAdaptiveCard(d.content))
                    }
                  }
                }
                if (attachment.elements && attachment.elements.length > 0) {
                  for (const e of attachment.elements) {
                    botMsg.cards.push(mapCard(e))
                  }
                }
              }
              if (attachment.type === 'stepper') {
                if (attachment.elements && attachment.elements.length > 0) {
                  for (const e of attachment.elements) {
                    botMsg.cards.push(mapCard(e))
                  }
                }
              }
              if (attachment.type === 'feedback') {
                botMsg.cards = botMsg.cards.concat(mapAdaptiveCard({
                  body: [
                    {
                      type: 'TextBlock',
                      text: 'Let us know your Feedback'
                    },
                    {
                      type: 'Input.ChoiceSet',
                      id: 'msg',
                      style: 'expanded',
                      isMultiSelect: false,
                      choices: [
                        { title: 'Love It! 😍', value: 'Love it' },
                        { title: 'Like It! 😃', value: 'Like It' },
                        { title: 'Dislike It! 🙁', value: 'Dislike it' }
                      ]
                    },
                    {
                      type: 'TextBlock',
                      text: 'Comment'
                    },
                    {
                      type: 'Input.Text',
                      id: 'comment',
                      maxLength: 500
                    }
                  ],
                  actions: [
                    {
                      type: 'Action.Submit',
                      title: 'Submit',
                      data: {
                        submitFeedback: true
                      }
                    },
                    {
                      type: 'Action.Submit',
                      title: 'Skip',
                      data: {
                        skipForm: true
                      }
                    }
                  ]
                }))
              }
            }
          }
        },
        [CoreCapabilities.SIMPLEREST_INBOUND_SELECTOR_JSONPATH]: '$.body.sessionId',
        [CoreCapabilities.SIMPLEREST_INBOUND_SELECTOR_VALUE]: '{{botium.conversationId}}'
      }
      for (const capKey of Object.keys(this.caps).filter(c => c.startsWith('SIMPLEREST'))) {
        if (!this.delegateCaps[capKey]) this.delegateCaps[capKey] = this.caps[capKey]
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

  async Start () {
    await this.delegateContainer.Start()
    this.delegateContainer.view.jsonStringify = () => (val, render) => {
      return render(val).replace(/"/g, '\\"')
    }
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
