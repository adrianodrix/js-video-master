const algorithmia = require('algorithmia')
const sentenceBoundaryDetection = require('sbd')
const algorithmiaApiKey = require('../credentials/algorithmia.json').apiKey

async function robot (content) {
  await fetchContentFromWikipedia(content)
  sanitizeContent(content)
  breakContentIntoSentences(content)

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
}

module.exports = robot
