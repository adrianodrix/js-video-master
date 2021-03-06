const algorithmia = require('algorithmia')
const sentenceBoundaryDetection = require('sbd')
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey

const watsonApiKey = require('../credentials/watson-nlu.json').apikey
const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1.js')

var nlu = new NaturalLanguageUnderstandingV1({
  iam_apikey: watsonApiKey,
  version: '2018-04-05',
  url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/'
})

async function robot (content) {
  await fetchContentFromWikipedia(content)
  sanitizeContent(content)
  breakContentIntoSentences(content)
  limitMaximumSentences(content)
  await fetchKeywordsOfAllSentences(content)

  async function fetchContentFromWikipedia (content) {
    let algorithmiaAuthenticated = algorithmia(algorithmiaApiKey)
    let wikipediaAlgorithm = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2?timeout=300')
    let wikipediaResponde = await wikipediaAlgorithm.pipe(content.searchTerm)
    let wikipediaContent = wikipediaResponde.get()

    content.sourceContentOriginal = wikipediaContent.content
  }

  function sanitizeContent (content) {
    let withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
    let withoutDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkdown)

    content.sourceContentSanitized = withoutDatesInParentheses

    function removeBlankLinesAndMarkdown (text) {
      let allLines = text.split('\n')

      let withoutBlankLinesAndMarkdown = allLines.filter((line) => {
        if (line.trim().length === 0 || line.trim().startsWith('=')) {
          return false
        }

        return true
      })

      return withoutBlankLinesAndMarkdown.join(' ')
    }
  }

  function removeDatesInParentheses (text) {
    // return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g,' ')
    return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '')
  }

  function breakContentIntoSentences (content) {
    content.sentences = []

    let sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
    sentences.forEach((sentence) => {
      content.sentences.push({
        text: sentence,
        keywords: [],
        images: []
      })
    })
  }

  function limitMaximumSentences (content) {
    content.sentences = content.sentences.slice(0, content.maximumSentences)
  }

  async function fetchKeywordsOfAllSentences (content) {
    for (const sentence of content.sentences) {
      sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text)
    }
  }

  async function fetchWatsonAndReturnKeywords (sentence) {
    return new Promise((resolve, reject) => {
      nlu.analyze({
        text: sentence,
        features: {
          keywords: {}
        }
      }, (error, response) => {
        if (error) {
          throw error
        }

        const keywords = response.keywords.map((keyword) => {
          return keyword.text
        })

        resolve(keywords)
      })
    })
  }
}

module.exports = robot
