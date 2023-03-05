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
    }
}