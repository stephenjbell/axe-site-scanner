const puppeteer = require('puppeteer')
const axeCore = require('axe-core')
const { parse: parseURL } = require('url')
const crawler = require('./crawler.js')
const {AssetCache} = require("@11ty/eleventy-fetch");
const slugify = require('@sindresorhus/slugify')
const dotenv = require('dotenv')
dotenv.config()
const sharp = require('sharp');


module.exports = async function () {

  // Load environment variables
  const domainUrl = process.env.DOMAIN_URL || 'https://steedgood.com' // Used to add domain to relative links
  const crawlStartUrl = process.env.CRAWL_START_URL || 'https://steedgood.com/' // Where we begin crawling
  const urlsMustContain = process.env.URLS_MUST_CONTAIN || 'steedgood.com' // Only search links that contain this
  const max_pages_to_crawl = process.env.MAX_PAGES_TO_CRAWL || 5
  const max_pages_to_scan = process.env.MAX_PAGES_TO_SCAN || 3
  const axe_scan_tags = process.env.AXE_SCAN_TAGS || "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa,section508,best-practice"
  const rate_limit_scanner = process.env.RATE_LIMIT_SCANNER || 0 // 0 = no rate limit
  const rate_limit_crawler = process.env.RATE_LIMIT_CRAWLER || 0 // 0 = no rate limit

  // Get the axe tags for tests from the environment variable, and format it to feed to axe.run()
  let run_only_scan_tags = ""
  if(axe_scan_tags){
    let scan_tags_array = axe_scan_tags.split(",")
    let scan_tags_output = "['" + scan_tags_array.join("','") + "']"

    run_only_scan_tags = `runOnly: {
      type: 'tag',
      values: ${scan_tags_output}
    },`
  }

  console.log("TAGS:",run_only_scan_tags)
  


  // Cache the crawl results
  let assetString = `SCAN ${domainUrl} ${crawlStartUrl} ${urlsMustContain} ${max_pages_to_crawl}`;
  let asset = new AssetCache( assetString );

  // check if the cache is fresh within the last day
  if(asset.isCacheValid("1d")) {
    // return cached data.
    console.log("Loading scanner data from cache...")
    return asset.getCachedValue(); // a promise
  }

  // Get list of urls using crawlSite()
  let pages
  try {
    pages = await crawler.crawlSite(domainUrl, crawlStartUrl, urlsMustContain, max_pages_to_crawl, rate_limit_crawler)
  } catch (error) {
    console.error(error)
    return []
  }

  // Setup Puppeteer
  const browser = await puppeteer.launch({
    headless: 'new',
    defaultArgs: ['--no-sandbox', '--disable-setuid-sandbox', '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36']
  })

  // Array to hold axe results for each URL
  const axeResults = {
    crawledPages: pages,
    resultPages: [],
    connectionIssues: {},
    violationsTotal: 0,
    incompleteTotal: 0,
  }

  // Loop through each page URL
  for(let i = 0; i < pages.length; i++) {
    const page = pages[i];

    if(rate_limit_scanner > 0){
      // Delay number of milliseconds between each page load
      console.log(`(Delaying ${rate_limit_scanner}ms...)`)
      await new Promise(resolve => setTimeout(resolve, rate_limit_scanner))
    }

    const url = page.url
    console.log(" ") // Add a blank line for readability
    console.log(`(${i+1}/${pages.length})`,"SCANNING PAGE:",page.url)

    // Create a slug from the URL using the slugify filter. Leave off the protocol and trailing slash
    let slug = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
    slug = slugify(slug)

    // If axeResults.resultPages already has this slug, skip it
    if(axeResults.resultPages.find(x => x.slug === slug)){
      console.log("Skipping page because we already have results for it")
      continue
    }

    // Validate URL
    if (!parseURL(url).protocol || !parseURL(url).host) {
      console.warn(`Invalid URL: ${url}`)
      continue
    }

    try {

      // Stop scanning if we've successfully scanned the max number of pages to scan
      if (axeResults.resultPages.length >= max_pages_to_scan) {
        break
      }

      // Get new page
      console.time(`Completed ${url}`)
      const pageInstance = await browser.newPage()

      const pageSize = [800,800]
      await pageInstance.setViewport({
        width: pageSize[0],
        height: pageSize[1]
      });
      // Set navigation timeout to 15 seconds instead of the default (30) to keep us from using up Netlify minutes
      await pageInstance.setDefaultNavigationTimeout(15000)
      const response = await pageInstance.goto(url)

      // Log if we get redirected
      if(response.url !== url){
        console.warn(`--> ${response.url()}`)
      }

      // Check if response.url is part of the site we should be scanning
      if (!response.url().includes(urlsMustContain)) {
        console.warn(`URL does not contain ${urlsMustContain}`)
        continue
      }

      // Check for connection issues
      if (response.status() !== 200) {
        console.warn(`Received status code ${response.status()} for ${url}`)
        
        // Tally up the connection issues to send to summary.json
        if(axeResults.connectionIssues[response.status()]){
          axeResults.connectionIssues[response.status()]++
        } else {
          axeResults.connectionIssues[response.status()] = 1
        }

        // Fail - Don't scan the page if we don't get a 200 response
        continue
      }

      // Get page title element 
      const pageTitle = await pageInstance.title()

      // Create screenshot of first page
      if(page.url === crawlStartUrl){
        // Create screenshot of page
        let options = {
          type: "jpeg",
          quality: 80,
          fullPage: false,
          captureBeyondViewport: false,
          clip: {
            x: 0,
            y: 0,
            width: pageSize[0], 
            height: pageSize[1],
          }
        };
        await pageInstance.screenshot(options).then(function (data) {
          console.time("Creating screenshot of " + url)
          // resize screenshot to 400x300 using sharp, then save as "./dist/img/screenshot.jpg" and "./dist/img/screenshot.webp" and "./dist/img/screenshot.avif"
          sharp(data).resize(400, 400).toFile('./dist/img/screenshot.jpg').then(function() {
            sharp(data).resize(400, 400).toFile('./dist/img/screenshot.webp').then(function() {
              sharp(data).resize(400, 400).toFile('./dist/img/screenshot.avif').then(function() {
                console.timeEnd("Creating screenshot of " + url)
              });
            });
          });
        });
      }

      // Try to get title of the page from the H1 element if it exists, otherwise fall back to "No H1"
      const pageH1 = await pageInstance.evaluate(() => {
        const h1 = document.querySelector('h1')
        if (h1) {
          if (h1.innerText) {
            return h1.innerText
          } else {
            const img = h1.querySelector('img')
            if (img) {
              return img.alt
            }
          }
        } else {
          return '(No H1 element on page)'
        }
      })

      console.log("H1:",pageH1)

      // Inject and run axe-core
      // Set options using https://www.deque.com/axe/core-documentation/api-documentation/#options-parameter
      const handle = await pageInstance.evaluateHandle(`
        // Inject axe source code
        ${axeCore.source}
        // Run axe
        axe.run({
            reporter: 'v2',
            resultTypes: ['violations','incomplete'],
            ancestry: true,
            ${run_only_scan_tags}
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
        result.nodeCount = result.nodes.length
        results.violationCountOnPage += result.nodeCount
      }

      for (const result of results.incomplete) {
        result.nodeCount = result.nodes.length
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

      console.timeEnd(`Completed ${url}`)

    } catch (err) {
      console.error(`Error running axe-core for ${url}:`, err.message)
      console.timeEnd(`Completed ${url}`)
    }
  }

  await browser.close()

  // Create a summary of the violations by type
  axeResults.violationsSummary = {}

  for(const page of axeResults.resultPages) {
    
    for(const violation of page.results.violations) {
      if(axeResults.violationsSummary[violation.help] != undefined) {
        axeResults.violationsSummary[violation.help] += violation.nodeCount
      } else {
        axeResults.violationsSummary[violation.help] = 1
      }
    }
  }

  // convert axeResults.violationsSummary to an array of objects like [{help: 'foo', count: 1}]
  axeResults.violationsSummary = Object.keys(axeResults.violationsSummary).map(function(key) {
    return {help: key, count: axeResults.violationsSummary[key]};
  });

  // Sort the violationsSummary array by count
  axeResults.violationsSummary.sort(function(a, b) {
    return b.count - a.count;
  });

  // Set axeResults.displayUrl by getting crawlStartUrl and removing the protocol and trailing slash
  axeResults.displayUrl = crawlStartUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')

  // Save the results to the cache
  asset.save(axeResults, "json");

  return axeResults
}
