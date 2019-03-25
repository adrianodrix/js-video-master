const NaturalLanguageUnderstandingV1 = require('watson-developer-cloud/natural-language-understanding/v1')

const algorithmia = require('algorithmia')
const sentenceBoundaryDetection = require('sbd')

const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey
const watsonApiKey = require('../credentials/watson-nlu.json').apikey

const nlu = new NaturalLanguageUnderstandingV1({
  iam_apikey: watsonApiKey,
  version: '2018-04-05',
  url: 'https://gateway.watsonplatform.net/natural-language-understanding/api/',
})

const state = require('./state')

async function robot() {
  async function fetchContentFromWikipedia(content) {
    const algorithmiaAuthenticated = algorithmia(algorithmiaApiKey)
    const wikipediaAlgorithm = algorithmiaAuthenticated.algo('web/WikipediaParser/0.1.2?timeout=300')
    const wikipediaResponde = await wikipediaAlgorithm.pipe(content.searchTerm)
    const wikipediaContent = wikipediaResponde.get()

    content.sourceContentOriginal = wikipediaContent.content
  }

  function removeDatesInParentheses(text) {
    // return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '').replace(/  /g,' ')
    return text.replace(/\((?:\([^()]*\)|[^()])*\)/gm, '')
  }

  function sanitizeContent(content) {
    function removeBlankLinesAndMarkdown(text) {
      const allLines = text.split('\n')

      const withoutBlankLinesAndMarkdown = allLines.filter((line) => {
        if (line.trim().length === 0 || line.trim().startsWith('=')) {
          return false
        }

        return true
      })

      return withoutBlankLinesAndMarkdown.join(' ')
    }

    const withoutBlankLinesAndMarkdown = removeBlankLinesAndMarkdown(content.sourceContentOriginal)
    const withoutDatesInParentheses = removeDatesInParentheses(withoutBlankLinesAndMarkdown)

    content.sourceContentSanitized = withoutDatesInParentheses
  }

  function breakContentIntoSentences(content) {
    content.sentences = []

    const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized)
    sentences.forEach((sentence) => {
      content.sentences.push({
        text: sentence,
        keywords: [],
        images: [],
      })
    })
  }

  function limitMaximumSentences(content) {
    content.sentences = content.sentences.slice(0, content.maximumSentences)
  }

  async function fetchWatsonAndReturnKeywords(sentence) {
    return new Promise((resolve) => {
      nlu.analyze({
        text: sentence,
        features: {
          keywords: {},
        },
      }, (error, response) => {
        if (error) {
          throw error
        }

        const keywords = response.keywords.map(keyword => keyword.text)

        resolve(keywords)
      })
    })
  }

  async function fetchKeywordsOfAllSentences(content) {
    // https://lavrton.com/javascript-loops-how-to-handle-async-await-6252dd3c795/
    // https://medium.com/@mathiasghenoazzolini/javascript-loops-com-async-await-8b07caf38017
    const promises = content.sentences.map(async (sentence) => {
      sentence.keywords = await fetchWatsonAndReturnKeywords(sentence.text)
      return sentence
    })

    await Promise.all(promises)
  }

  const content = state.load()

  await fetchContentFromWikipedia(content)
  sanitizeContent(content)
  breakContentIntoSentences(content)
  limitMaximumSentences(content)
  await fetchKeywordsOfAllSentences(content)

  state.save(content)
}

module.exports = robot
