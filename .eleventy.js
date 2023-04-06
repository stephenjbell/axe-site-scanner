const sass = require("sass");
const dayjs = require('dayjs');
const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");

module.exports = function(eleventyConfig) {
  eleventyConfig.setServerOptions({

    liveReload: true,
    domDiff: true,
    port: 8080,

    // Additional files to watch that will trigger server updates
    // Accepts an Array of file paths or globs (passed to `chokidar.watch`).
    // Works great with a separate bundler writing files to your output folder.
    // e.g. `watch: ["_site/**/*.css"]`


    // Show local network IP addresses for device testing
    showAllHosts: true,

    // Change the default file encoding for reading/serving files
    encoding: "utf-8",
  });


  // Passthrough the img and js folders
  eleventyConfig.addPassthroughCopy("src/img");
  eleventyConfig.addPassthroughCopy("src/js");

  // Multipurpose shortcode for retrieving CURRENT date
  // If format string is left off, date will display in ISO8601
  // https://day.js.org/docs/en/display/format
  eleventyConfig.addShortcode('nowdate', function (formatString) {
    var now = new Date()
    return dayjs(now).format(formatString)
  })


  // Set up SASS compilation
  eleventyConfig.addTemplateFormats("scss");

  // Set up syntax highlighting
  console.log("HIGHLIGHT: ", syntaxHighlight)
  eleventyConfig.addPlugin(syntaxHighlight);

  // Creates the extension for use
  eleventyConfig.addExtension("scss", {
    outputFileExtension: "css", // optional, default: "html"

    // `compile` is called once per .scss file in the input directory
    compile: async function(inputContent) {
      let result = sass.compileString(inputContent);

      // This is the render function, `data` is the full data cascade
      return async (data) => {
        return result.css;
      };
    }
  });

  return {
    markdownTemplateEngine: 'njk',
    dataTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    dir: {
      input: 'src',
      output: 'dist',
    },
  }
};