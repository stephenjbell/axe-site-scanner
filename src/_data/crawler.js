var Crawler = require('crawler')

module.exports = async function () {
  var domainUrl = 'https://usvisagroup.com'
  var startUrl = 'https://usvisagroup.com/'
  var baseUrl = 'https://usvisagroup.com/'

  var visitedUrls = []

  var c = new Crawler({
    maxConnections: 10,
    callback: function (error, res, done) {
      if (error) {
        console.log(error)
      } else {
        var $ = res.$
        // console.log('TITLE: ' + $('title').text())

        // Find all links on the page
        $('a').each(function () {
          var link = $(this).attr('href')

          // If the link starts with /, add the domain url
          if (link && link.startsWith('/')) {
            link = domainUrl + link
          }

          // Strip off anything after a hash
          if (link.indexOf('#') > -1) {
            link = link.substring(0, link.indexOf('#'))
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
          if (excludeExtensions.some((ext) => link.endsWith(ext))) {
            link = null
          }

          // Only follow links that start with baseUrl, and that we haven't already visited
          if (link && link.startsWith(baseUrl) && !visitedUrls.includes(link)) {
            visitedUrls.push(link)
            console.log('PAGELIST LENGTH' + visitedUrls.length)
            console.log('QUEUEING ' + link)
            c.queue(link)
          }
        })
      }
      done()
    },
  })

  c.queue(startUrl)

  c.on('drain', function () {
    console.log(visitedUrls)
  })

  // TODO - Figure out how to return the visitedUrls array
  return visitedUrls
}
