# Botium Connector for Wipro Holmes

????

[![NPM](https://nodei.co/npm/botium-connector-holmes.png?downloads=true&downloadRank=true&stars=true)](https://nodei.co/npm/botium-connector-holmes/)

[![Codeship Status for codeforequity-at/botium-connector-holmes](https://app.codeship.com/projects/2bb81a70-c59f-0137-b318-6afa87cdc716/status?branch=master)](https://app.codeship.com/projects/366879)
[![npm version](https://badge.fury.io/js/botium-connector-holmes.svg)](https://badge.fury.io/js/botium-connector-holmes)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg)]()


This is a [Botium](https://github.com/codeforequity-at/botium-core) connector for testing your [Wipro Holmes](https://www.wipro.com/holmes/) chatbot.

__Did you read the [Botium in a Nutshell](https://medium.com/@floriantreml/botium-in-a-nutshell-part-1-overview-f8d0ceaf8fb4) articles? Be warned, without prior knowledge of Botium you won't be able to properly use this library!__

## How it works
Botium connects to the API of your Wipro Holmes chatbot.

It can be used as any other Botium connector with all Botium Stack components:
* [Botium CLI](https://github.com/codeforequity-at/botium-cli/)
* [Botium Bindings](https://github.com/codeforequity-at/botium-bindings/)
* [Botium Box](https://www.botium.at)

## Requirements
* **Node.js and NPM**
* a **Wipro Holmes bot**
* a **project directory** on your workstation to hold test cases and Botium configuration

## Install Botium and Holmes Connector

When using __Botium CLI__:

```
> npm install -g botium-cli
> npm install -g botium-connector-holmes
> botium-cli init
> botium-cli run
```

When using __Botium Bindings__:

```
> npm install -g botium-bindings
> npm install -g botium-connector-holmes
> botium-bindings init mocha
> npm install && npm run mocha
```

When using __Botium Box__:

_Already integrated into Botium Box, no setup required_

## Connecting Holmes chatbot to Botium

Process is very simple, you have to know just the endpoint URL for your chatbot.
  
Create a botium.json with this URL in your project directory: 

```
{
  "botium": {
    "Capabilities": {
      "PROJECTNAME": "<whatever>",
      "CONTAINERMODE": "holmes",
      "HOLMES_URL": "..."
    }
  }
}
```

To check the configuration, run the emulator (Botium CLI required) to bring up a chat interface in your terminal window:

```
> botium-cli emulator
```

Botium setup is ready, you can begin to write your [BotiumScript](https://github.com/codeforequity-at/botium-core/wiki/Botium-Scripting) files.

## How to start samples

There is two small demos in [samples](./samples) with Botium Bindings. One uses a mocked Holmes API, other one uses real Holmes API.

### Mocked sample
You have to start the [Mock API](./samples/mocked/MockApi) first. This API accepts every request, and sends a constant response back.

* Install packages, run Mock API
```
> cd ./samples/mocked
> npm install && npm mock
```

* And start the test

```
> cd ./samples/mocked
> npm test
```

### Real Holmes API sample

* Adapt botium.json in the sample directory if required (change URL, delete other HOLMES_* entries)
* Install packages, run the test

```
> cd ./samples/real
> npm install && npm test
```

## Supported Capabilities

Set the capability __CONTAINERMODE__ to __holmes__ to activate this connector.

### HOLMES_URL
Holmes chatbot endpoint url

### HOLMES_SERVICE_URL
Holmes service url

Optional. Default same as HOLMES_URL. 

### HOLMES_USER
User name

Optional. Default "user".

### HOLMES_USER_ID
User id

Optional. Default "user@wipro.com". 

### HOLMES_CHANNEL
Channel in escaped JSON format. 

Example:
```
"{\"id\": \"2\",\"type\": \"web\",\"lang\": \"en\"}"
```

Optional. Default 
```
{"id": "1","type": "web","lang": "en"}
```

### Roadmap
* Support for intent/entity asserter
* Support for sentiment analyze
