import fetch from 'node-fetch'
import cheerio from 'cheerio'

const { URL } = require('url')

// parameters
const domain = 'www.nytimes.com'
const baseUrl = `http://${domain}`
const results = {}
const maxDepth = 10
const term = 'trump'
const contextChars = 10
const timeout = 10000
// end parameters

/**
 * Crawls a url until max depth has been reached
 * @param {String} url 
 * @param {Integer} depth 
 * @return {Promise}
 */
function crawl(url, depth=0) {
    if (results[url] || depth > maxDepth) {
        return Promise.resolve()
    } else {
        const result = results[url] = []
        url = ensureAbsolute(url)

        return fetch(url, { timeout })
            .then(res => {
                if (res.headers.get("content-type").startsWith('text/html')) {
                    return res.text()
                } else {
                    return null
                }
            })
            .then(html =>{
                if (!html) return
                console.log(depth, url)
                addMatches(term, result, getText(html))
                return Promise.all(findUrls(html).map(url => crawl(url, depth + 1)))                
            })
            .catch(error => console.log('could not fetch ' + url))
    }
}

/**
 * Returns all urls that should be crawled
 * @param {String} html 
 */
function findUrls(html) {
    let $ = cheerio.load(html)
    const urls = []
        
    $('a').each((i, element) => {
        let $element = $(element)
        const url = $element.attr('href')
        
        if (shouldCrawl(url)) {
            urls.push(url)
        }
    })

    return urls
}

/**
 * Return the text in the document
 * @param {String} html 
 */
function getText(html) {
    return cheerio.load(html)('body').text()
}

/**
 * Adds matches for the specified term
 * @param {String} term 
 * @param {Array} matches 
 * @param {String} text 
 */
function addMatches(term, matches, text) {
    const regex = new RegExp(term, 'gi');
    let result, indices = [];

    while ( (result = regex.exec(text)) ) {
        const start = Math.max(0, result.index - contextChars)
        const end = result.index + term.length + contextChars
        matches.push(text.slice(start, end));
    }
}

/**
 * Returns true if the url isn't local (#) and is on the same domain
 * @param {String} url 
 * @return {Boolean}
 */
function shouldCrawl(url) {
    if (!url || url.startsWith('#')) {
        return false
    }

    url = new URL(url, baseUrl)

    return url.hostname === domain
}

/**
 * Converts the url from relative to absolute if relative
 * @param {String} url 
 */
function ensureAbsolute(url) {
    if (url.match(/^https?:\/\//)) {
        return url
    } else {
        return new URL(url, baseUrl).href
    }
}

crawl(baseUrl).then(() => {
    console.log('\n\npages crawled = ' + Object.keys(results).length)

    for (let url in results) {
        const matches = results[url];

        if (matches.length) {
            console.log(`url: ${url}, matches: ${results[url].join(', ')}`)
        }
    }
})