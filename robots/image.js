const { google } = require('googleapis')

const imageDownloader = require('image-downloader') 

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
      // imgSize: 'large', 
      // imgType: 'photo',
      // imgColorType: 'color',      
      // filter: '1',
      // safe: 'active',
      // rights: '(cc_publicdomain|cc_attribute|cc_sharealike)',     
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

  async function downloadAndSave(url, fileName) {
    return imageDownloader.image({
      url, url,
      dest: `./content/${fileName}`
    })
  }
  
  async function downloadAllImages(content) {
    content.downloadedImages = []

    for (let sentenceIndex = 0; sentenceIndex < content.sentences.length; sentenceIndex++) {
      const images = content.sentences[sentenceIndex].images

      for (let imageIndex = 0; imageIndex < images.length; imageIndex++) {
        const imageUrl = images[imageIndex]

        try {
          if (content.downloadedImages.includes(imageUrl)) {
            throw new Error('Imagem já foi baixada.')
          }

          await downloadAndSave(imageUrl, `${sentenceIndex}-original.png`)
          content.downloadedImages.push(imageUrl)
          console.info(`> [${sentenceIndex}][${imageIndex}] Baixou imagem com sucesso: ${imageUrl}`)
          break
        } catch(error) {
          console.error(`> [${sentenceIndex}][${imageIndex}] Erro ao baixar ${imageUrl}: ${error}`)
        }
      }
    }
  }

  const content = state.load()

  await fetchImagesOfAllSentences(content)
  await downloadAllImages(content)
  
  state.save(content)
}

module.exports = robot