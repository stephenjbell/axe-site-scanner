const puppeteer = require('puppeteer')
const axeCore = require('axe-core')
const { parse: parseURL } = require('url')
const assert = require('assert')

const crawler = require('./crawler.js')

async function crawlSite() {
  try {
    const results = await crawler.crawlSite()
    return results

  } catch (error) {
    console.error(error)
  }
}

module.exports = async function () {
  // Get list of urls using crawlSite()
  let pages = await crawlSite()

  // Cheap URL validation
  const isValidURL = (input) => {
    const u = parseURL(input)
    return u.protocol && u.host
  }

  // Setup Puppeteer
  const browser = await puppeteer.launch()

  // Array to hold axe results for each URL
  const axeResults = []

  // Loop through each page URL
  for (let page of pages) {
    const url = page.url

    // Validate URL
    assert(isValidURL(url), 'Invalid URL')

    try {
      // Get new page
      const page = await browser.newPage()
      const response = await page.goto(url)

      if (response.status() !== 200) {
        console.warn(`Received status code ${response.status()} for ${url}.`)
      }

      // Inject and run axe-core
      // Set options using https://www.deque.com/axe/core-documentation/api-documentation/#options-parameter
      const handle = await page.evaluateHandle(`
        // Inject axe source code
        ${axeCore.source}
        // Run axe
        axe.run({
            ancestry: true,
            reporter: 'v2',
        })
    `)

      // Get the results from `axe.run()`.
      const results = await handle.jsonValue()
      // Destroy the handle
      await handle.dispose()

      // Remove results.inapplicable and results.passes
      delete results.inapplicable
      delete results.passes

      console.log("Saving results for " + url)

      // Add results to axeResults array
      axeResults.push({
        url: url,
        results: results,
      })
    } catch (err) {
      console.error(`Error running axe-core for ${url}:`, err.message)
    }
  }

  await browser.close()

  return axeResults
}
