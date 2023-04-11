const puppeteer = require('puppeteer')
const axeCore = require('axe-core')
const { parse: parseURL } = require('url')
const crawler = require('./crawler.js')
const {AssetCache} = require("@11ty/eleventy-fetch");
const slugify = require('@sindresorhus/slugify')
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

  // Cache the crawl results
  let assetString = `SCAN ${domainUrl} ${crawlStartUrl} ${urlsMustContain} ${max_pages_to_crawl}`;
  let asset = new AssetCache( assetString );

  // check if the cache is fresh within the last day
  if(asset.isCacheValid("1s")) {
    // return cached data.
    console.log("Loading scanner data from cache...")
    return asset.getCachedValue(); // a promise
  }

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
    violationsTotal: 0,
    incompleteTotal: 0,
  }

  // Loop through each page URL
  for (const page of pages) {
    const url = page.url

    // Create a slug from the URL using the slugify filter. Leave off the protocol and trailing slash
    let slug = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    slug = slugify(slug)


    // Validate URL
    if (!parseURL(url).protocol || !parseURL(url).host) {
      console.warn(`Invalid URL: ${url}`)
      continue
    }

    try {
      // Get new page
      console.time(`--Scanned ${url}`)
      const pageInstance = await browser.newPage()
      const response = await pageInstance.goto(url)

      if (response.status() !== 200) {
        console.warn(`Received status code ${response.status()} for ${url}.`)
      }

      // Get page title element 
      const pageTitle = await pageInstance.title()

      // Try to get title of the page from the H1 element if it exists, otherwise fall back to "No H1"
      const pageH1 = await pageInstance.evaluate(() => {
        const h1 = document.querySelector('h1')
        if (h1) {
          return h1.innerText
        } else {
          return '(No H1 element on page)'
        }
      })

      console.log(pageH1)

      // Inject and run axe-core
      // Set options using https://www.deque.com/axe/core-documentation/api-documentation/#options-parameter
      const handle = await pageInstance.evaluateHandle(`
        // Inject axe source code
        ${axeCore.source}
        // Run axe
        axe.run({
            reporter: 'v2',
            resultTypes: ['violations','incomplete'],
        })
      `)

      // Get the results from `axe.run()`.
      const results = await handle.jsonValue()
      // Destroy the handle
      await handle.dispose()

      // Remove results.inapplicable and results.passes
      delete results.inapplicable
      delete results.passes

      // Tally up the violations and incompletes for each page
      results.violationCountOnPage = 0
      results.incompleteCountOnPage = 0
      for (const result of results.violations) {

        result.nodeCount = 0

        for (const node of result.nodes) {
          result.nodeCount += node.any.length
          result.nodeCount += node.all.length
          result.nodeCount += node.none.length
        }

        results.violationCountOnPage += result.nodeCount
      }

      for (const result of results.incomplete) {

        result.nodeCount = 0

        for (const node of result.nodes) {
          result.nodeCount += node.any.length
          result.nodeCount += node.all.length
          result.nodeCount += node.none.length
        }

        results.incompleteCountOnPage += result.nodeCount
      }

      // Add to the total violations and incompletes
      axeResults.violationsTotal += results.violationCountOnPage
      axeResults.incompleteTotal += results.incompleteCountOnPage

      // Add results to axeResults.resultPages array

      axeResults.resultPages.push({
        pageH1,
        pageTitle,
        slug,
        results,
      })

      console.timeEnd(`--Scanned ${url}`)

    } catch (err) {
      console.error(`Error running axe-core for ${url}:`, err.message)
    }
  }

  await browser.close()

  // Save the results to the cache
  asset.save(axeResults, "json");

  return axeResults
}
