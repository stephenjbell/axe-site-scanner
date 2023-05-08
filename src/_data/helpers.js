const luxon = require("luxon");

module.exports = {
    currentYear() {
        return luxon.DateTime.local().year;
    },
    // Write a helper function
    // When passed a date string like "2023-03-05T20:27:05.852Z", returns something like "Mar. 5, 2023 at 8:27PM"
    // See https://moment.github.io/luxon/docs/manual/formatting.html#table-of-tokens
    formatDate(dateString, format="fff") {
        const date = luxon.DateTime.fromISO(dateString);
        return date.toFormat( format);
    },
    // Reformat the tags associated with each issue (https://www.deque.com/axe/core-documentation/api-documentation/#user-content-axe-core-tags)
    // When passed an array like ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "section508", "bestpractice","wcag***"]
    // Returns an array like ["WCAG 2.0 A", "WCAG 2.0 AA", "WCAG 2.1 A", "WCAG 2.1 AA", "WCAG 2.2 AA", "Section 508", "Best Practices","WCAG SC 1.1.1"]
    adjustTags(tagsArray){

        // Remove tags that start with anything in our list of tags to remove
        const tagsToRemove = ["cat.","TT","section508."]
        tagsArray = tagsArray.filter(tag => {
            let remove = false
            tagsToRemove.forEach(tagToRemove => {
                if(tag.startsWith(tagToRemove)){
                    remove = true
                }
            })
            return !remove
        })

        // Loop through tags and reformat them to be readable
        let output = []
        tagsArray.forEach(tag => {
            let newTag = tag
            newTag = newTag.replace("wcag2aa","WCAG 2.0 AA")
            newTag = newTag.replace("wcag21a","WCAG 2.1 A")
            newTag = newTag.replace("wcag21aa","WCAG 2.1 AA")
            newTag = newTag.replace("wcag22aa","WCAG 2.2 AA")
            newTag = newTag.replace("wcag2a","WCAG 2.0 A")
            newTag = newTag.replace("section508","Old Section 508")
            newTag = newTag.replace("best-practice","Best Practices")
            //regex replace for section508.*.*
            newTag = newTag.replace(/section(508\.[\d]+\.[a-z]+)/g, "Section $1")
            // regex replace for wcag***
            newTag = newTag.replace(/wcag(\d)(\d)(\d)/g, "WCAG SC $1.$2.$3")

            // push original tag and new tag
            output.push([tag,newTag])
        })
        return output

    }

}