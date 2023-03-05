const puppeteer = require('puppeteer')
const axeCore = require('axe-core')
const { parse: parseURL } = require('url')
const crawler = require('./crawler.js')
const {AssetCache} = require("@11ty/eleventy-fetch");
const dotenv = require('dotenv')
dotenv.config()


module.exports = async function () {

  // Load environment variables
  const domainUrl = process.env.DOMAIN_URL || 'https://steedgood.com' // Used to add domain to relative links
  const crawlStartUrl = process.env.CRAWL_START_URL || 'https://steedgood.com/' // Where we begin crawling
  const urlsMustContain = process.env.URLS_MUST_CONTAIN || 'steedgood.com' // Only search links that contain this
  const site_title = process.env.SCANNED_SITE_TITLE || 'Steed'
  const number_of_pages = process.env.NUMBER_OF_PAGES || 3
  const max_pages_to_crawl = process.env.MAX_PAGES_TO_CRAWL || 5

  // Get list of urls using crawlSite()
  let pages
  try {
    pages = await crawler.crawlSite(domainUrl, crawlStartUrl, urlsMustContain, max_pages_to_crawl)
  } catch (error) {
    console.error(error)
    return []
  }

  // Setup Puppeteer
  const browser = await puppeteer.launch()

  // Array to hold axe results for each URL
  const axeResults = {
    crawledPages: pages,
    resultPages: [],
  }

  // Loop through each page URL
  for (const page of pages) {
    const url = page.url

    // Validate URL
    if (!parseURL(url).protocol || !parseURL(url).host) {
      console.warn(`Invalid URL: ${url}`)
      continue
    }

    try {
      // Get new page
      const pageInstance = await browser.newPage()
      const response = await pageInstance.goto(url)

      if (response.status() !== 200) {
        console.warn(`Received status code ${response.status()} for ${url}.`)
      }

      // Inject and run axe-core
      // Set options using https://www.deque.com/axe/core-documentation/api-documentation/#options-parameter
      const handle = await pageInstance.evaluateHandle(`
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

      console.log(`axe-core scanned ${url}`)

      // Add results to axeResults.resultPages array

      axeResults.resultPages.push({
        url,
        results,
      })

    } catch (err) {
      console.error(`Error running axe-core for ${url}:`, err.message)
    }
  }

  await browser.close()

  return axeResults
}
