const puppeteer = require('puppeteer')
const axeCore = require('axe-core')
const { parse: parseURL } = require('url')
const assert = require('assert')

const crawler = require('./crawler.js');

async function crawlSite() {
  try {
    const results = await crawler.crawlSite();
    console.log(results);

  } catch (error) {
    console.error(error);
  }
}

crawlSite();


module.exports = async function () {
  // Most of this code based on https://github.com/dequelabs/axe-core/tree/develop/doc/examples/puppeteer

  const myUrl = 'https://steedgood.com'

  // Cheap URL validation
  const isValidURL = (input) => {
    const u = parseURL(input)
    return u.protocol && u.host
  }

  // node axe-puppeteer.js <url>
  const url = myUrl
  assert(isValidURL(url), 'Invalid URL')

  const main = async (url) => {
    let browser
    let results
    try {
      // Setup Puppeteer
      browser = await puppeteer.launch()

      // Get new page
      const page = await browser.newPage()
      const response = await page.goto(url)

      if (response.status() !== 200) {
        console.warn(
          `Received status code ${response.status()} for ${url}.`
        )
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
      results = await handle.jsonValue()
      // Destroy the handle & return axe results.
      await handle.dispose()
    } catch (err) {
      // Ensure we close the puppeteer connection when possible
      if (browser) {
        await browser.close()
      }

      // Re-throw
      throw err
    }

    await browser.close()
    return results
  }

  let axeResults = await main(url)
    .then((results) => {
      // Return the results
      return results
    })
    .catch((err) => {
      console.error('Error running axe-core:', err.message)
      process.exit(1)
    })

  // Remove axeResults.inapplicable and axeResults.passes
  delete axeResults.inapplicable
  delete axeResults.passes

  let something = 'Hey'

  return {
    something: something,
    results: axeResults,
  }
}
