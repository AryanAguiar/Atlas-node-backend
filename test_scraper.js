import { scrapeArticle } from "./services/scraper.js";

async function testScraper() {
    const urls = [
        "https://www.bbc.com/news/world-us-canada-68653468", // Example news article
        "https://example.com", // Simple static site
        "https://google.com/404", // 404 test
    ];

    console.log("Starting scraper test...\n");

    for (const url of urls) {
        console.log(`Testing URL: ${url}`);
        const start = Date.now();
        const text = await scrapeArticle(url);
        const duration = Date.now() - start;

        if (text) {
            console.log(`✅ Success (${duration}ms)`);
            console.log(`Preview: ${text.substring(0, 150)}...`);
            console.log(`Length: ${text.length} chars`);
        } else {
            console.log(`❌ Failed or Empty (${duration}ms)`);
        }
        console.log("-".repeat(50) + "\n");
    }
}

testScraper();
