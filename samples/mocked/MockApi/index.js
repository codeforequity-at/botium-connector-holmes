var express = require('express')
var app = express()

app.post('/', function (req, res) {
  res.json(
    {
      "text": "I can assist you with information on following topics. Please select one of them.",
      "attachments": [
        {
          "data": [
            "Outlook",
            "WebEx",
            "Voip",
            "Skype",
            "None of These"
          ],
          "type": "button"
        }
      ],
      "trace": {
        "lang": "en",
        "entities": [],
        "intent": {},
        "input": "Ask a Question",
        "mod-input": "Ask a Question",
        "behav-analysis": {
          "sentiment": "Positive"
        }
      },
      "speak": "I can assist you with information on following topics. Please select one of them."
    }
  )
})

app.listen(3568, function () {
  console.log('Mock api is listening on port 3568!')
})

