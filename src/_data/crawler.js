const Crawler = require('crawler')
const {AssetCache} = require("@11ty/eleventy-fetch");
const dotenv = require('dotenv')
dotenv.config()

module.exports = { async crawlSite (domainUrl, crawlStartUrl, urlsMustContain, max_pages_to_crawl) {

  // Cache the crawl results
  let assetString = `CRAWL ${domainUrl} ${crawlStartUrl} ${urlsMustContain} ${max_pages_to_crawl}`;
  let asset = new AssetCache( assetString );

  // check if the cache is fresh within the last day
  if(asset.isCacheValid("1d")) {
    // return cached data.
    console.log("Loading crawler data from cache...")
    return asset.getCachedValue(); // a promise
  }


  let urlList = [crawlStartUrl]
  let pagesInfo = [
    {
      url: crawlStartUrl,
      innav: true,
    }
  ]

  let c = new Crawler({
    maxConnections: 10,
    retryTimeout: 3000, // Wait 3 seconds before retrying instead of 10
    retries: 1,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    callback: function (error, res, done) {
      if (error) {
        console.log(error)
      } else {
        var $ = res.$

        // Check if the response is a valid HTML document
        if (/^text\/html/.test(res.headers['content-type'])) {

          let blocked = false;
          if(res.statusCode != 200){
            console.log("ERROR: Status code",res.statusCode)
          }

          if($('html').text().includes("Incapsula incident")) {
            blocked = true;
            console.log("BLOCKED:",$('html').text())
          }

          if($('html').text().includes("Cloudflare")) {
            blocked = true;
            console.log("BLOCKED:",$('html').text())
          }

          // Check if the URL has redirected or returned a 404 status
          if (res.statusCode === 200 && !res.request.uri.href.includes('/404') && !blocked) {

            console.log("  Queued: "+ c.queueSize +"  Visiting: " + res.request.uri.href)

            

            // Find all links on the page
            $('a').each(function () {

              // Get the link href
              let link_href = $(this).attr('href')

              // If the link starts with #, exclude it
              if (link_href && link_href.startsWith('#')) {
                link_href=null
              }

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
                '.ics',
              ]
              if (link_href && excludeExtensions.some((ext) => link_href.toLowerCase().endsWith(ext))) {
                link_href=null
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
              if (link_href && excludeProtocols.some((str) => link_href.toLowerCase().startsWith(str))) {
                link_href=null
              }

              // Check if the link is in the top menu
              let inNav = false

              // If the link is "nav a" that isn't in <main>
              if($(this).is("nav a") && !$(this).parents("main").length){
                inNav = true
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

      if(pagesInfo.length > 0){

        // Remove trailing slash from all urls
        pagesInfo.forEach((page) => {
          page.url = page.url.replace(/\/$/, '')
        })

        // Remove pages with duplicate URLs, ignoring uppercase/lowercase, including pages with different protocols (http/https)
        pagesInfo = pagesInfo.filter((page, index, self) =>
          index === self.findIndex((t) => (
            t.url.toLowerCase().replace(/https?:\/\//, '') === page.url.toLowerCase().replace(/https?:\/\//, '')
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
      }

      console.log("Pages crawled: " + pagesInfo.length)

      asset.save(pagesInfo, "json");

      resolve(pagesInfo)
    })
  })
}
}
