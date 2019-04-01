const { google } = require('googleapis')

const customSearch = google.customsearch('v1')
const state = require('./state')

const googleSearchCredentials = require('../credentials/google-search')

async function robot() {
  async function fetchGoogleAndReturnImagesLinks(query) {
    const response = await customSearch.cse.list({
      auth: googleSearchCredentials.apiKey,
      cx: googleSearchCredentials.searchEngineID,
      q: query,
      searchType: 'image',
      num: 2,
    })

    return response.data.items.map(item => item.link)
  }

  async function fetchImagesOfAllSentences(content) {
    const promises = content.sentences.map(async (sentence) => {
      const query = `${content.searchTerm} ${sentence.keywords[0]}`
      sentence.images = await fetchGoogleAndReturnImagesLinks(query)
      sentence.googleSearchQuery = query
    })

    await Promise.all(promises)
  }

  const content = state.load()

  await fetchImagesOfAllSentences(content)
  
  state.save(content)
}

module.exports = robot