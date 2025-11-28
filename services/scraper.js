import axios from "axios";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { parseDocument } from "htmlparser2";
import { DomUtils } from "htmlparser2";

export async function scrapeArticle(url, retries = 2) {
    if (url.match(/\.(pdf|doc|docx|xlsx)$/i)) return "";

    const headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9"
    };

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const res = await axios.get(url, {
                timeout: 6000,
                maxRedirects: 5,
                headers
            });

            if (!res.data || res.data.length < 500) continue;

            const dom = new JSDOM(res.data);
            const article = new Readability(dom.window.document).parse();
            if (!article) continue;

            // EXACT PYTHON BEHAVIOR
            const parsed = parseDocument(article.content);
            const text = DomUtils.textContent(parsed).trim();

            if (text.length < 100) continue;

            return text.slice(0, 5000);

        } catch {
            continue;
        }
    }

    return "";
}
