const Crawler = require('crawler')
const {AssetCache} = require("@11ty/eleventy-fetch");
const dotenv = require('dotenv')
dotenv.config()

module.exports = { async crawlSite (domainUrl, crawlStartUrl, urlsMustContain, max_pages_to_crawl) {

  console.log(`${domainUrl} ${crawlStartUrl} ${urlsMustContain} ${max_pages_to_crawl}`)

  // Cache the crawl results
  let assetString = `${domainUrl} ${crawlStartUrl} ${urlsMustContain} ${max_pages_to_crawl}`;
  let asset = new AssetCache( assetString );

  // check if the cache is fresh within the last day
  if(asset.isCacheValid("1d")) {
    // return cached data.
    return asset.getCachedValue(); // a promise
  }


  let urlList = []
  let pagesInfo = []

  let c = new Crawler({
    maxConnections: 10,
    retryTimeout: 3000, // Wait 3 seconds before retrying instead of 10
    retries: 1,
    callback: function (error, res, done) {
      if (error) {
        console.log(error)
      } else {
        var $ = res.$

        // Check if the response is a valid HTML document
        if (/^text\/html/.test(res.headers['content-type'])) {

          // TODO: This still isn't able to detect if the page redirects before it 200 OKs
          // Check if the URL has redirected or returned a 404 status
          if (res.statusCode === 200 && !res.request.uri.href.includes('/404')) {

            console.log("  Queued: "+ c.queueSize +"  Visiting: " + res.request.uri.href)

            // Find all links on the page
            $('a').each(function () {
              
              // Check if the link is in the top menu
              let inNav = false

              // If the link is "nav a" that isn't in <main>
              if($(this).is("nav a") && !$(this).parents("main").length){
                inNav = true
              }

              // Get the link href
              let link_href = $(this).attr('href')

              // If the link starts with //, add "https:"
              if (link_href && link_href.startsWith('//')) {
                link_href = "https:" + link_href
              }

              // If the link starts with /, add the domain url
              if (link_href && link_href.startsWith('/')) {
                link_href = domainUrl + link_href
              }

              // Strip off anything after a hash
              if (link_href && link_href.indexOf('#') > -1) {
                link_href = link_href.substring(0, link_href.indexOf('#'))
              }

              // Strip off anything after a question mark
              if (link_href && link_href.indexOf('?') > -1) {
                link_href = link_href.substring(0, link_href.indexOf('?'))
              }

              // Exclude links that are non-document files
              let excludeExtensions = [
                '.pdf',
                '.doc',
                '.docx',
                '.xls',
                '.xlsx',
                '.ppt',
                '.pptx',
                '.zip',
                '.rar',
                '.7z',
                '.mp3',
                '.mp4',
                '.mov',
                '.avi',
                '.wmv',
                '.jpg',
                '.jpeg',
                '.png',
                '.gif',
                '.svg',
              ]
              if (link_href && excludeExtensions.some((ext) => link_href.endsWith(ext))) {
                return false
              }

              // If a link starts with a string from our list, exclude it
              let excludeProtocols = [
                'mailto:',
                'tel:',
                'ftp:',
                'javascript:',
                'skype:',
                'whatsapp:',
                'webcal:',
              ]
              if (link_href && excludeProtocols.some((str) => link_href.startsWith(str))) {
                return false
              }

              // Only follow links that start with urlMustContain, and that we haven't already visited
              // and if we haven't passed the max number of pages to crawl
              if (link_href && link_href.includes(urlsMustContain) && !urlList.includes(link_href) && urlList.length < max_pages_to_crawl) {

                urlList.push(link_href)
                pagesInfo.push({ 
                  url: link_href, 
                  innav: inNav 
                })

                // console.log('urlList.length:' + urlList.length)

                c.queue(link_href)
              }
            })
          }
        }
      }
      done()
    },
  })

  c.queue(crawlStartUrl)

  // Do all this when the crawler is finished
  return new Promise(resolve => {
    c.on('drain', function () {

      // Set the first page we scanned to be "in nav" (important)
      pagesInfo[0].innav = true

      // Remove trailing slash from all urls
      pagesInfo.forEach((page) => {
        page.url = page.url.replace(/\/$/, '')
      })

      // Remove pages with duplicate URLs
      pagesInfo = pagesInfo.filter((page, index, self) =>
        index === self.findIndex((t) => (
          t.url === page.url
        ))
      )

      // Sort pages info to put "innav" pages first, then sort by URL
      pagesInfo.sort(function(a, b) {
        if (a.innav === b.innav) {
          return a.url.localeCompare(b.url);
        }
        else if (a.innav) {
          return -1;
        }
        else {
          return 1;
        }
      });

      console.log("Pages crawled: " + pagesInfo.length)

      asset.save(pagesInfo, "json");

      resolve(pagesInfo)
    })
  })
}
}
