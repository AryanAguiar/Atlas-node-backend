import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import axios from "axios";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import Claim from "../models/claimsModel.js";

puppeteer.use(StealthPlugin());

// ---------------------------
// Browser (reusable)
// ---------------------------
let browser = null;

async function getBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1920,1080"
            ],
            defaultViewport: {
                width: 1920,
                height: 1080
            }
        });
    }
    return browser;
}

// ---------------------------
// SCRAPER
// ---------------------------

export const extractPageData = async (url) => {
    const browser = await getBrowser();
    const page = await browser.newPage();

    try {
        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
        );

        await page.setRequestInterception(true);
        page.on("request", (req) => {
            const type = req.resourceType();
            if (type === "document") req.continue();
            else req.abort(); // skip images, styles, fonts
        });

        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        let html = await page.content();

        // --- PRE-CLEAN HTML ---
        // Remove scripts, styles, headers, footers, nav
        html = html.replace(/<script[\s\S]*?<\/script>/gi, "");
        html = html.replace(/<style[\s\S]*?<\/style>/gi, "");
        html = html.replace(/<header[\s\S]*?<\/header>/gi, "");
        html = html.replace(/<footer[\s\S]*?<\/footer>/gi, "");
        html = html.replace(/<nav[\s\S]*?<\/nav>/gi, "");
        html = html.replace(/<aside[\s\S]*?<\/aside>/gi, ""); // optional

        // --- CREATE DOM ---
        const doc = new JSDOM(html, { url });

        // --- RUN READABILITY ---
        const reader = new Readability(doc.window.document);
        const article = reader.parse();

        return article?.textContent || "";

    } catch (err) {
        console.error("Scrape Error:", err.message);
        return "";
    } finally {
        if (page && !page.isClosed()) await page.close();
    }
};


// Quotes / speech / commentary
const QUOTES = [
    /^["“”]/,           // starts with quote
    /["“”]$/,           // ends with quote
    /: ["“]/,           // said: "
    /^[^"]*["“][^"]*["”]/ // contains full quote block
];

// Live blog & intros
const LIVE_BLOG = [
    /^\w+,\s*\d{1,2}\s+\w+\s+\d{4}/i,       // date intros
    /^it[’']s\s+\w+/i,                      // It's Friday...
    /this is .* live/i,                     // Europe Live, US Politics Live
    /^live:/i
];

// Questions / rhetorical / analysis framing
const QUESTIONS = [
    /\?$/,                                  // ends in ?
    /^why\b/i,
    /^how\b/i,
    /the key question/i,
    /^analysis\b/i
];

// Noise / metadata / captions
const NOISE = [
    /©/i, /getty images/i, /reuters/i,
    /bbc news/i, /image caption/i,
    /^\d+\s+(hours?|minutes?)\s+ago/i,
    /^updated/i, /cookies/i, /subscribe/i,
    /^related/i
];

// Headlines (no punctuation)
const HEADLINES = [
    /^[A-Z][A-Za-z\s]+$/,                   // Title-like
    /^[A-Z][a-z]+\s[A-Z][a-z]+$/            // Two-word title
];

// Attribution-only (not claims)
const ATTRIBUTION = [
    /^\w+\s+(said|told|announced|claimed|reported|argued|warned|insisted)\b/i,
    /^according to\b/i,
    /\bsaid:\b/i,
    /\brepeated\b/i,
    /\breiterated\b/i
];

// ---------------------------
// OPINION FILTERS (SOFT)
// ---------------------------

const OPINION = [
    // speculation / hedging
    /\b(might|may|could|possibly|perhaps|unlikely|likely)\b/i,
    /\b(expected to|appears to|seems to|suggests that)\b/i,

    // normative judgement
    /\bshould\b/i,
    /\bmust\b/i,
    /\bneed to\b/i,
    /\bought to\b/i,

    // motives / intent
    /\bwants? to\b/i,
    /\bhopes? to\b/i,
    /\btries? to\b/i,

    // strong subjective phrasing
    /\bno real signs\b/i,
    /\bbrutal war\b/i,
    /\breally moving\b/i,

    // political rhetoric
    /\bjust and lasting\b/i,
    /\bto blame\b/i,

    // meta-opinion reporters
    /\bexperts say\b/i,
    /\banalysts say\b/i,
    /\bcritics say\b/i,
    /\bhe said\b/i,
    /\bshe said\b/i,
    /\bcommentators\b/i,

    // generic opinions
    /\bbelieves?\b/i,
    /\bthinks?\b/i,
    /\bargues?\b/i,
    /\bfears?\b/i
];

// ---------------------------
// REQUIRED FACTUAL SIGNAL
// ---------------------------

const FACTUAL = [
    /\b(is|are|was|were|has|have|had)\b/i,
    /\b(killed|injured|captured|approved|introduced|launched)\b/i,
    /\b(increased|decreased|rose|fallen|grew|declined)\b/i,
    /\b(signed|blocked|intercepted|sanctioned)\b/i
];

function mergedRelatedSentences(sentences) {
    const out = [];
    let buf = "";

    for (const s of sentences) {
        const trimmed = s.trim();
        if (!trimmed) continue;

        if (/[\.\!\?]$/.test(trimmed)) {
            // complete sentence
            if (buf) {
                out.push((buf + " " + trimmed).trim());
                buf = "";
            } else {
                out.push(trimmed);
            }
        } else {
            // dangling fragment
            buf += " " + trimmed;
        }
    }

    if (buf) out.push(buf.trim());
    return out;
}


// ---------------------------
// FINAL isClaim FUNCTION
// ---------------------------
const ALL_HARD_REJECT = [...NOISE, ...LIVE_BLOG, ...HEADLINES, ...QUESTIONS, ...QUOTES, ...ATTRIBUTION];

function isClaim(sentence) {
    const s = sentence.trim().toLowerCase();
    if (s.length < 25) return false;

    for (const p of ALL_HARD_REJECT) {
        if (p.test(s)) return false;
    }

    for (const p of OPINION) {
        if (p.test(s)) return false;
    }

    // factual + entity
    if (!FACTUAL.some(p => p.test(s))) return false;

    if (!(/[A-Z][a-z]{3,}/.test(sentence) || /\d/.test(sentence))) return false;

    return true;
}

function scoreClaim(sentence) {
    const s = sentence.trim();
    const lower = s.toLowerCase();

    if (s.length < 20) return 0; // very short → low score

    let score = 5; // base score

    // ---------------------------
    // HARD REJECTS → heavy penalty
    // ---------------------------
    if ([...NOISE, ...LIVE_BLOG, ...HEADLINES, ...QUESTIONS].some(p => p.test(s))) score -= 3;
    if ([...QUOTES, ...ATTRIBUTION].some(p => p.test(s))) score -= 3;

    // ---------------------------
    // OPINION REJECTS → mild penalty
    // ---------------------------
    if (OPINION.some(p => p.test(lower))) score -= 2;

    // ---------------------------
    // FACTUAL SIGNALS → boost
    // ---------------------------
    const factMatches = FACTUAL.filter(p => p.test(lower)).length;
    score += factMatches; // +1 per factual signal matched

    // ---------------------------
    // Entity / number check → boost
    // ---------------------------
    const hasEntity = /[A-Z][a-z]{3,}/.test(s);
    const hasNumber = /\d/.test(s);
    if (hasEntity) score += 1;
    if (hasNumber) score += 1;

    // ---------------------------
    // Clamp score 0–10
    // ---------------------------
    if (score > 10) score = 10;
    if (score < 0) score = 0;

    return score;
}

// ------------------------------------------------------
// Export extractor
// ------------------------------------------------------
const ABBREVIATIONS = [
    "Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Inc.", "Ltd.", "Jr.", "Sr.", "St.",
    "vs.", "etc.", "e.g.", "i.e.", "U.S.A.", "U.K."
];

export function extractClaimsFromText(text) {
    if (!text) return [];

    // Normalize whitespace
    text = text.replace(/\s+/g, " ").trim();

    const sentences = [];
    let buffer = "";
    let parenDepth = 0;

    // Split character by character
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        buffer += char;

        if (char === "(") parenDepth++;
        if (char === ")") parenDepth = Math.max(0, parenDepth - 1);

        if ((char === "." || char === "!" || char === "?") && parenDepth === 0) {
            // Check if this is a known abbreviation (look back)
            const lastWord = buffer.split(" ").slice(-2).join(" ");
            if (!ABBREVIATIONS.some(abbr => lastWord.endsWith(abbr))) {
                sentences.push(buffer.trim());
                buffer = "";
            }
        }
    }

    // Push remaining buffer
    if (buffer.trim()) sentences.push(buffer.trim());

    const mergedSentences = mergedRelatedSentences(sentences);

    // Filter for claims and score them
    return mergedSentences
        .filter(isClaim)
        .map(c => ({ claim: c, label: "claim", score: scoreClaim(c) }));
}

// ---------------------------
// MONGO SAVE (ONLY CLAIM + LABEL)
// ---------------------------
export const createClaimDocuments = async (claimsArray) => {
    if (!claimsArray.length) return [];

    // Convert classification objects → DB objects
    const docs = claimsArray.map(c => ({
        claim: c.claim,
        label: c.label,
        score: c.score,
        createdAt: new Date()
    }));

    return await Claim.insertMany(docs);
};

// ---------------------------
// MAIN CONTROLLER
// ---------------------------
export const processNewsArticle = async (req, res) => {
    const { url } = req.body;

    if (!url) return res.status(400).json({ error: "Missing URL" });

    try {
        // 1) Scrape
        const text = await extractPageData(url);

        // 2) Extract claims
        const claims = await extractClaimsFromText(text);

        if (!claims.length) {
            return res.json({ message: "No claims found on this page", claims: [] });
        }

        // 3) Save to DB
        const saved = await createClaimDocuments(claims);

        res.json({
            rawClaims: saved
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to process article" });
    }
};
