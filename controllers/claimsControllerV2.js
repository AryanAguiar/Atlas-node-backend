import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import axios from "axios";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import Claim from "../models/claimsModel.js";

puppeteer.use(StealthPlugin());

// Browser (reusable)
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

// SCRAPER

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
        html = html.replace(/<\/?(header|footer|nav|aside)[^>]*>/gi, "");
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

function resolvePronouns(sentences) {
    const malePronouns = ["he", "him"];
    const femalePronouns = ["she", "her"];
    const neutralPronouns = ["they", "them"];
    const petKeywords = ["dog", "cat", "puppy", "kitten", "pet", "horse"];

    // Words that should never be considered names
    const blockedNames = new Set([
        // ===== MONTHS =====
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",

        // ===== DAYS =====
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",

        // ===== COUNTRIES =====
        "India", "Pakistan", "Bangladesh", "Sri", "Lanka", "Nepal", "Bhutan",
        "China", "Japan", "Korea", "Russia", "Ukraine", "USA", "Canada", "Chechen",
        "Mexico", "Brazil", "Argentina", "Chile", "Peru", "Armenia",
        "France", "Germany", "Spain", "Italy", "UK", "Ireland",
        "Australia", "New", "Zealand", "South", "Africa", "Egypt",
        "Saudi", "Arabia", "UAE", "Dubai", "Qatar", "Kuwait", "Oman",

        // ===== NATIONALITIES / ADJECTIVES =====
        "Pakistani", "Bangladeshi", "Nepali", "Bhutanese", "Russian", "Ukrainian", "Chinese", "Japanese", "Korean",
        "American", "Canadian", "Mexican", "Brazilian", "Argentinian", "German", "French", "Italian", "Spanish", "British", "Irish", "Chechnya",
        "Australian", "Egyptian", "Saudi", "Arab", "African", "European", "Afghan", "Albanian", "Algerian", "Angolan",
        "Argentinian", "Armenian", "Australian", "Austrian", "Azerbaijani", "Bahamian", "Bangladeshi", "Barbadian", "Belarusian", "Belgian",
        "Belizean", "Beninese", "Bhutanese", "Bolivian", "Bosnian", "Botswanan", "Brazilian", "British", "Bulgarian", "Burmese",
        "Burundian", "Georgian", "Cambodian", "Cameroonian", "Canadian", "Chadian", "Chilean", "Chinese", "Colombian", "Congolese", "Costa Rican", "Croatian",
        "Cuban", "Cypriot", "Czech", "Danish", "Dominican", "Dutch", "Ecuadorian", "Egyptian", "Emirati", "English", "Estonian",
        "Ethiopian", "Fijian", "Filipino", "Finnish", "French", "Gabonese", "Gambian", "Georgian", "German", "Ghanaian", "Greek",
        "Guatemalan", "Guyanese", "Haitian", "Honduran", "Hungarian", "Icelandic", "Indian", "Indonesian", "Iranian", "Iraqi",
        "Irish", "Israeli", "Italian", "Ivorian", "Jamaican", "Japanese", "Jordanian", "Kazakh", "Kenyan", "Korean", "Kuwaiti", "Kyrgyz", "Lao", "Latvian", "Lebanese", "Liberian", "Libyan", "Lithuanian",
        "Luxembourgish", "Macedonian", "Malagasy", "Malawian", "Malaysian", "Maldivian", "Malian", "Maltese", "Mauritanian", "Mexican", "Moldovan",
        "Mongolian", "Montenegrin", "Moroccan", "Mozambican", "Myanmar", "Namibian", "Nepali", "New Zealander", "Nicaraguan", "Nigerian",
        "Norwegian", "Omani", "Pakistani", "Panamanian", "Paraguayan", "Peruvian", "Philippine", "Polish", "Portuguese", "Puerto Rican",
        "Qatari", "Romanian", "Russian", "Rwandan", "Salvadoran", "Samoan", "Saudi", "Scottish", "Senegalese",
        "Serbian", "Singaporean", "Slovak", "Slovenian", "Somalian", "South African", "Spanish", "Sri Lankan", "Sudanese",
        "Surinamese", "Swazi", "Swedish", "Swiss", "Syrian", "Tajik", "Tanzanian", "Thai", "Togolese", "Tongan", "Trinidadian",
        "Tunisian", "Turkish", "Turkmen", "Ugandan", "Ukrainian", "Uruguayan", "Uzbek", "Venezuelan", "Vietnamese", "Welsh", "Yemeni", "Zambian", "Zimbabwean", "Chechen", "European",

        // ===== INDIAN STATES =====
        "Maharashtra", "Goa", "Gujarat", "Rajasthan", "Punjab",
        "Haryana", "Karnataka", "Kerala", "Tamil", "Nadu", "Andhra", "Pradesh",
        "Telangana", "Odisha", "Bihar", "Jharkhand", "West", "Bengal",
        "Assam", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
        "Tripura", "Sikkim", "Uttarakhand", "Uttar", "Pradesh",

        // ===== MAJOR INDIAN CITIES =====
        "Mumbai", "Pune", "Delhi", "Kolkata", "Chennai", "Hyderabad",
        "Bengaluru", "Bangalore", "Ahmedabad", "Jaipur", "Lucknow",
        "Surat", "Indore", "Bhopal", "Nagpur", "Patna", "Vadodara",
        "Noida", "Gurgaon", "Thane", "Kochi", "Agra", "Varanasi",

        // ===== MIDDLE EAST / ASIA CITIES =====
        "Tehran", "Baghdad", "Riyadh", "Jeddah", "Doha",
        "Kabul", "Tashkent", "Astana", "Hanoi", "Bangkok",
        "Singapore", "Hong", "Kong", "Shanghai", "Beijing", "Manila",

        // ===== EUROPEAN CITIES =====
        "London", "Paris", "Berlin", "Rome", "Madrid", "Lisbon",
        "Vienna", "Athens", "Warsaw", "Prague", "Budapest", "Georgia",

        // ===== GOVERNMENT / AGENCIES =====
        "Police", "Court", "Government", "State", "Ministry", "Department",
        "Army", "Navy", "Air", "Force", "Parliament", "Marine", "Battalion",
        "Regiment", "Platoon", "Brigade", "Commander", "General",
        "Colonel", "Major", "Captain", "Lieutenant", "Squad",

        // ===== INTERNATIONAL ORGS =====
        "UN", "UNESCO", "UNICEF", "NATO", "WHO", "WTO", "IMF", "World", "Bank",
        "EU", "ASEAN", "BRICS", "OPEC", "Interpol", "Amnesty",
        "Red", "Cross", "Human", "Rights", "Watch",

        // ===== GOVERNMENT BODIES =====
        "Cabinet", "Senate", "Congress", "House", "Assembly",
        "Supreme", "High", "Court", "Tribunal", "Commission",
        "Agency", "Authority", "Bureau", "Department",
        "Task", "Force", "Committee", "Council",

        // ===== CRIME & LEGAL TERMS =====
        "Suspect", "Victim", "Accused", "Convict", "Judge", "Jury",
        "Lawyer", "Attorney", "Prosecutor", "Defendant",
        "Officer", "Detective", "Inspector", "Sheriff",
        "Witness", "Informer", "Whistleblower",

        // ===== NEWS EVENTS =====
        "War", "Conflict", "Battle", "Strike", "Protest", "Rally",
        "Explosion", "Blast", "Accident", "Crash", "Flood", "Earthquake",
        "Cyclone", "Hurricane", "Tornado", "Wildfire", "Storm",
        "Eruption", "Landslide", "Avalanche", "Outbreak", "Pandemic",
        "Epidemic", "Crisis", "Emergency", "Attack", "Shooting",
        "Hostage", "Bombing", "Raid", "Arrest", "Detention",

        // ===== TITLES / ROLES / PROFESSIONS =====
        "Doctor", "Dr", "Engineer", "Officer", "Judge", "Lawyer",
        "Minister", "President", "Prime", "Secretary", "Director",
        "Captain", "Commander", "Professor", "Teacher",

        // ===== GROUPS =====
        "People", "Man", "Woman", "Men", "Women", "Children",
        "Child", "Adult", "Teen", "Boy", "Girl",

        // ===== CAPITALIZED COMMON WORDS =====
        "This", "That", "These", "Those", "Such", "Which",
        "Here", "There", "Where", "When", "Why", "How",

        // ===== QUANTIFIERS =====
        "Both", "Each", "Every", "Either", "Neither",
        "One", "Two", "Three", "Four", "Five", "Six",
        "First", "Second", "Third", "Fourth", "Fifth",

        // ===== RARE FALSE POSITIVES =====
        "Among", "Between", "During", "Before", "After",
        "Through", "Across", "Against", "Without",

        // ===== NEWS-SPECIFIC EXCLUSIONS =====
        "Breaking", "Latest", "Update", "Exclusive", "Report",
        "Tragic", "Major", "Massive", "Dramatic",
        "Severe", "Critical", "Official", "Street", "Road", "Highway", "Bridge",
        "River", "Lake", "Ocean", "Sea",
        "Station", "Airport", "Railway", "Metro",
        "School", "College", "University",
        "Temple", "Church", "Mosque", "Synagogue",
        "Festival", "Holiday", "Ritual",
        "CEO", "CFO", "CTO", "Founder", "Co-Founder",
        "Director", "Manager", "Chairman", "Executive",
        "Doctor", "Nurse", "Hospital", "Clinic", "Researchers",
        "Scientists", "Study", "Lab", "Vaccine",

        // ===== TERROR / SECURITY TERMS =====
        "Militant", "Terrorist", "Extremist", "Insurgent",
        "Rebel", "Separatist", "Gang", "Cartel", "Syndicate",
        "Smuggler", "Trafficker",

        // ===== GEOGRAPHICAL NEWS TERMS =====
        "Border", "Frontier", "Region", "Province", "Territory",
        "District", "County", "Town", "Village",
        "Capital", "Island", "Peninsula", "Harbour", "Port",

        // ===== ECONOMY & BUSINESS =====
        "Market", "Economy", "Stock", "Exchange", "Index",
        "Company", "Corporation", "Enterprise", "Startup",
        "Tech", "Industry", "Manufacturing", "Exports",
        "Imports", "Trade", "GDP", "Inflation", "Recession",

        // ===== POLITICAL TERMS =====
        "President", "Prime", "Minister", "Chancellor",
        "Leader", "Speaker", "Governor", "Mayor",
        "Senator", "MP", "MLA", "Representative",
    ]);

    // Track all known entities
    let entities = [];

    //name extractor
    function extractNames(sentence) {
        // Match 1–3 capitalized words (e.g. Aishat, James Duggan)
        let matches = sentence.match(/\b([A-Z][a-z]+)(?:\s+[A-Z][a-z]+){0,2}\b/g) || [];

        return matches.filter(name => {
            if (blockedNames.has(name)) return false;

            // Skip standalone capitalized "In", "On", etc.
            if (/^(In|On|At|By|For|From|With|During)$/i.test(name)) return false;

            // Skip nationality/country adjectives like Armenian, Russian
            if (/^(.*?)(ian|ese|ish|an|ic)$/i.test(name) && name.split(" ").length === 1)
                return false;

            const tokens = sentence.trim().split(/\s+/);
            if (tokens[0] === name && name.split(" ").length === 1) return false;

            return true;
        });
    }

    // Determine if entity is human or pet
    function detectEntityType(name, sentence) {
        if (petKeywords.some(k => sentence.toLowerCase().includes(k))) {
            return "pet";
        }
        return "human";
    }

    // Choose the best entity for a pronoun
    function getBestEntityForPronoun(pronoun) {
        const lower = pronoun.toLowerCase();

        const possible = entities.filter(e => {
            if (malePronouns.includes(lower)) return e.gender === "male";
            if (femalePronouns.includes(lower)) return e.gender === "female" || e.type === "pet";
            if (neutralPronouns.includes(lower)) return true;
            return false;
        });

        if (possible.length === 0) return null;

        // Most recent appropriate entity
        return possible[possible.length - 1];
    }

    return sentences.map((sentence, idx) => {
        let s = sentence.trim();

        // Extract names safely
        const nameMatches = extractNames(s);

        // Register new entities
        for (const fullName of nameMatches) {
            const lastName = fullName.split(" ").slice(-1)[0];

            // Detect gender from the sentence
            let gender = null;
            if (/\bhe\b|\bhim\b/i.test(s)) gender = "male";
            if (/\bshe\b|\bher\b/i.test(s)) gender = "female";

            entities.push({
                name: fullName,
                lastName,
                type: detectEntityType(fullName, s),
                gender,
                index: idx
            });
        }

        // Replace pronouns with best entity
        s = s.replace(/\b(he|him|she|her|they|them)\b/gi, (match, offset) => {
            const entity = getBestEntityForPronoun(match);
            if (!entity) return match;

            const lower = match.toLowerCase();

            // Look ahead to detect "her + noun"
            const rest = s.slice(offset + match.length).trim();
            const nextWord = rest.split(/\s+/)[0];

            const isPossessive =
                (lower === "her" || lower === "his" || lower === "their") &&
                /^[a-z]+$/i.test(nextWord); // next word is a noun-ish token

            if (isPossessive) {
                return entity.name + "'s";
            }

            // Otherwise normal replacement
            const useLastName = s.includes(entity.lastName);
            return useLastName ? entity.lastName : entity.name;
        });

        return s;
    });
}

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

const SOFT_OBSERVATION = [
    /\bbody language\b/i,
    /\bappearance\b/i,
    /\blooks?\b/i,
    /\bseemed?\b/i,
    /\bappeared?\b/i,
    /\bfelt\b/i,
    /\bvisibly\b/i,
    /\bclearly\b/i,
    /\bparticularly\b/i,  // soft emphasizer
    /\bsoftened\b/i,
    /\brelaxed\b/i,
    /\btensed\b/i,
];

const PURE_OPINION = [
    /^i think\b/i,
    /^i believe\b/i,
    /^i feel\b/i,
    /^in my opinion\b/i,
    /^from my perspective\b/i,
    /^we think\b/i,
    /^we believe\b/i,
    /\bi doubt\b/i,
    /\bit is my view\b/i,
    /\bpersonally\b/i,
    /\barguably\b/i
];

const SUBJECTIVE = [
    /\bgood\b/i, /\bbad\b/i, /\bterrible\b/i, /\bexcellent\b/i,
    /\bimportant\b/i, /\bcrucial\b/i, /\bshocking\b/i,
    /\bcontroversial\b/i, /\bdisappointing\b/i
];

// Noise / metadata / captions
const NOISE = [
    /©/i, /getty images/i, /reuters/i,
    /bbc news/i, /image caption/i,
    /^\d+\s+(hours?|minutes?)\s+ago/i,
    /^updated/i, /cookies/i, /subscribe/i,
    /^related/i,
    /click here/i,
    /read more/i,
    /follow us/i,
    /share this/i,
    /advertisement/i,
    /sponsored/i,
    /trending/i,
    /breaking news/i
];

// Headlines (no punctuation)
const HEADLINES = [
    /^[A-Z][A-Za-z\s]+$/,                   // Title-like
    /^[A-Z][a-z]+\s[A-Z][a-z]+$/            // Two-word title
];

const FILTER_BLOCKLIST = [
    /not responsible for/i,
    /all rights reserved/i,
    /cookies/i,
    /privacy policy/i,
    /terms and conditions/i,
    /advertis(e|ement)/i,
    /subscribe/i,
    /sign up/i,
    /contact us/i,
];

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

const EMOTIONAL = [
    /\bterrified\b/i,
    /\bafraid\b/i,
    /\bworried\b/i,
    /\bpleading\b/i,
    /\bupset\b/i,
    /\bshocked\b/i,
    /\bdistraught\b/i,
    /\bheartbroken\b/i,
    /\bdevastated\b/i,
    /\btraumatised\b/i,
    /\bin tears\b/i,
    /\bcrying\b/i,
    /\btearfully\b/i,
    /\bgrieving\b/i,
    /\bgrief\-stricken\b/i,
    /\bfrightened\b/i,
    /\bpanicked\b/i,
    /\bfearful\b/i,
    /\bdesperate\b/i,
    /\bhelpless\b/i,
    /\bin despair\b/i,
    /\banguish\b/i,
    /\banguished\b/i,
    /\bemotional\b/i,
    /\bchoked up\b/i,
    /\bheartfelt\b/i
];

const DENIALS = [
    /\bdisputes? (these|the|this)? claims?\b/i,
    /\bdenies? (these|the|this)? claims?\b/i,
    /\brejects? (these|the|this)? claims?\b/i,
    /\bdismissed? (these|the|this)? claims?\b/i
];

const PERSONAL_STORY = [
    /\bhis wife\b/i,
    /\bher husband\b/i,
    /\btheir daughter\b/i,
    /\bliving with\b/i,
    /\blives in\b/i,
    /\bnow lives\b/i,
    /\bhas been living\b/i,
    /\bwent home\b/i,
    /\bback home\b/i,

    // more narrative markers
    /\bhis son\b/i,
    /\bher son\b/i,
    /\bhis daughter\b/i,
    /\bher daughter\b/i,
    /\bhis family\b/i,
    /\bher family\b/i,
    /\bthe family\b/i,
    /\bchildhood\b/i,
    /\bgrew up\b/i,
    /\bwas born in\b/i,
    /\braised in\b/i,
    /\boriginally from\b/i,
    /\bhas been struggling\b/i,
    /\bhas been trying\b/i,
    /\bhas been waiting\b/i,
    /\bafter losing\b/i,
    /\bafter he lost\b/i,
    /\bafter she lost\b/i,
    /\bshared memories\b/i,
    /\btold her story\b/i,
    /\bshared his story\b/i,
    /\brecalls?\b/i,
    /\bremembers?\b/i,
    /\bdescribed\b/i,
    /\bspoke about\b/i,

    // typical human-interest patterns
    /\bhis final moments\b/i,
    /\bher final moments\b/i,
    /\bthe last time he\b/i,
    /\bthe last time she\b/i,
    /\bhe said through tears\b/i,
    /\bshe said through tears\b/i,
    /\bwith tears\b/i,
    /\btrying to rebuild\b/i,
    /\btrying to survive\b/i,
    /\bfled with\b/i,
    /\bcarrying only\b/i,
    /\bpacked what they could\b/i
];

const NARRATIVE_STRUCTURE = [
    /^when he\b/i,
    /^when she\b/i,
    /^when they\b/i,
    /^as he\b/i,
    /^as she\b/i,
    /^as they\b/i,
    /^earlier that day\b/i,
    /^later that evening\b/i,
    /^by the time\b/i,
    /^on his way\b/i,
    /^on her way\b/i,
    /^on their way\b/i,
    /\bthat morning\b/i,
    /\bthat afternoon\b/i,
    /\bthat evening\b/i,
    /\bthe moment\b/i,
    /\bseconds later\b/i,
    /\bminutes later\b/i,
    /\bshortly after\b/i,
    /\bjust before\b/i,
    /\bjust after\b/i,
    /^shackled\b/i,
    /^moments earlier\b/i,
    /^earlier\b/i,
    /^later\b/i,
    /^in the video\b/i,
    /^in video\b/i,
    /^in footage\b/i,
    /^one monday\b/i,
    /^one morning\b/i,
    /^that night\b/i,
    /^the next day\b/i,
];

function isPronounHeavy(sentence) {
    const pronouns = sentence.match(/\b(he|she|they|him|her|them)\b/gi) || [];
    const namedEntities = sentence.match(/\b[A-Z][a-z]+\b/g) || [];
    return pronouns.length >= 2 && namedEntities.length === 0;
}

function isQuoted(sentence) {
    const trimmed = sentence.trim();
    // starts AND ends with quotes
    if (/^["“].*["”]$/.test(trimmed)) return true;

    // spoken attribution e.g., said: "..."
    if (/:\s*["“]/.test(trimmed)) return true;

    return false;
}

// REQUIRED FACTUAL SIGNAL

const FACTUAL = [
    /\b(is|are|was|were|has|have|had)\b/i,
    /\b(killed|injured|captured|approved|introduced|launched)\b/i,
    /\b(increased|decreased|rose|fallen|grew|declined)\b/i,
    /\b(signed|blocked|intercepted|sanctioned)\b/i,
    /\binclude(?:s|d)?\b/i
];

function mergedRelatedSentences(sentences) {
    const out = [];
    let buf = "";

    function isShort(s, words = 10) {
        return s.trim().split(/\s+/).length <= words;
    }

    function continuesContext(s) {
        return /^(both|these|those|they|it|this|that|which|the region|the regions|the area|the areas|he|she|the secretary|the minister|the group|the company)\b/i.test(s);
    }

    // NEW: detect start of a new headline/topic
    function isTopicShift(prev, curr) {
        if (!prev) return false;

        // If previous ends normally but current starts with a capital word (headline)
        if (/^[A-Z][a-z]+/.test(curr) && /[a-z]$/.test(prev)) return true;

        // Very long sentence followed by another long one → likely different topic
        if (prev.split(" ").length > 15 && curr.split(" ").length > 15) return true;

        // Headlines often have no period and multiple capital chunks
        if (/[A-Z][a-z]+ [A-Z][a-z]+/.test(curr)) return true;

        return false;
    }

    for (const s of sentences) {
        const trimmed = s.trim();
        if (!trimmed) continue;

        // Skip ultra-short noise
        if (trimmed.split(/\s+/).length < 3) continue;

        if (buf) {
            // NEW: If topic shift → finalize immediately
            if (isTopicShift(buf, trimmed)) {
                out.push(buf);
                buf = trimmed;
                continue;
            }

            // Normal merge rules
            if (isShort(trimmed) || continuesContext(trimmed)) {
                buf += " " + trimmed;
                continue;
            }

            // Finalize and start new
            out.push(buf);
            buf = trimmed;
            continue;
        }

        // No buffer yet → just start
        buf = trimmed;
    }

    if (buf) out.push(buf);
    return out;
}

const ATTRIBUTION_PATTERNS = [
    /(.+?)\s+(?:said|stated|told reporters|reported|claimed|alleged|argued|warned|insisted|announced|noted|mentioned|according to)\s+that\s+(.+)/i,
    /according to\s+(.+?),\s+(.+)/i
];

//extracts attribution claims
function extractAttributedClaim(sentence) {
    for (const pattern of ATTRIBUTION_PATTERNS) {
        const match = sentence.match(pattern);
        if (match) {
            // Handle different patterns
            if (pattern === ATTRIBUTION_PATTERNS[0]) {
                // Pattern: "X said that Y"
                return {
                    fullSentence: sentence,
                    speaker: match[1].trim(),
                    action: match[2] ? match[0].match(/\bsaid|stated|claimed|alleged|reported|told reporters\b/i)[0] : "",
                    claim: match[2].trim()
                };
            } else if (pattern === ATTRIBUTION_PATTERNS[1]) {
                // Pattern: "According to X, Y"
                return {
                    fullSentence: sentence,
                    speaker: match[1].trim(),
                    action: "according to",
                    claim: match[2].trim()
                };
            }
        }
    }

    // No attribution detected → return the sentence itself as claim
    return {
        fullSentence: sentence,
        speaker: null,
        action: null,
        claim: sentence.trim()
    };
}

const ALL_HARD_REJECT = [...NOISE, ...LIVE_BLOG, ...HEADLINES, ...QUESTIONS, ...QUOTES,];

function isClaim(sentence) {
    const raw = sentence.trim();

    // --- STEP 0: Extract embedded claim if attribution exists ---
    let claimText = raw;
    const extracted = extractAttributedClaim(raw);
    if (extracted && extracted.claim) {
        claimText = extracted.claim;
    }

    const s = claimText.toLowerCase();

    // ---- BASIC FILTERS ----
    if (s.length < 25) return false;
    if (!/[A-Za-z]/.test(s)) return false;

    // Reject rhetorical or non-assertive forms
    if (/[?!]$/.test(s)) return false;

    if (PURE_OPINION.some(r => r.test(s))) return false;
    if (NARRATIVE_STRUCTURE.some(r => r.test(s))) return false;
    if (PERSONAL_STORY.some(r => r.test(s))) return false;
    if (EMOTIONAL.some(r => r.test(s))) return false;
    if (SUBJECTIVE.some(r => r.test(s))) return false;
    if (isQuoted(claimText)) return false;
    if (isPronounHeavy(claimText)) return false;
    if (SOFT_OBSERVATION.some(r => r.test(s))) return false;
    if (DENIALS.some(r => r.test(s))) return false;

    // Reject news noise / timestamps / metadata
    if (ALL_HARD_REJECT.some(r => r.test(s))) return false;

    // Reject speculation or hedging
    if (OPINION.some(r => r.test(s))) return false;

    // ---- MUST have factual verb ----
    if (!FACTUAL.some(r => r.test(s))) return false;

    // ---- MUST reference something (entity or number) ----
    const hasEntity = /\b[A-Z][A-Za-z’']{2,}\b/.test(claimText);
    const hasNumber = /\d+/.test(claimText);
    if (!hasEntity && !hasNumber) return false;

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
    if ([...QUOTES,].some(p => p.test(s))) score -= 3;

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

const ABBREVIATIONS = [
    "Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Inc.", "Ltd.", "Jr.", "Sr.", "St.",
    "vs.", "etc.", "e.g.", "i.e.", "U.S.A.", "U.K."
];

function removeTimePrefixes(text) {
    return text
        // "4 hrs ago", "5 hrs ago", "12 hrs ago"
        .replace(/^\s*\d+\s*hrs?\s*ago\s*/i, "")
        // "31 mins", "12m", "12 m", "31min ago"
        .replace(/^\s*\d+\s*m(ins?)?\s*(ago)?\s*/i, "")
        // "1 day ago"
        .replace(/^\s*\d+\s*day[s]?\s*ago\s*/i, "")
        .trim();
}

const CATEGORY_PREFIXES = [
    "US & Canada",
    "Africa",
    "Asia",
    "Europe",
    "Middle East",
    "Australia",
    "Latin America",
    "Premier League",
    "Editor's picks",
    "The Travel Show",
    "Business",
    "Tech",
    "Sport",
    "Science",
    "Entertainment",
    "Lifestyle",
    "Video",
    "World",
];

function removeCategoryPrefixes(text) {
    for (const cat of CATEGORY_PREFIXES) {
        const pattern = new RegExp("^" + cat.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&") + "\\s*", "i");
        text = text.replace(pattern, "").trim();
    }
    return text;
}

export function extractClaimsFromText(text) {
    if (!text) return [];

    // Normalize whitespace
    text = text.replace(/\s+/g, " ").trim();

    const sentences = [];
    let buffer = "";
    let parenDepth = 0;
    let insideQuote = false; // Track quote state

    const ABBREVIATIONS_LOWER = ABBREVIATIONS.map(a => a.toLowerCase());

    // Sentence splitting with quote awareness
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        buffer += char;

        // Track parentheses depth
        if (char === "(") parenDepth++;
        if (char === ")") parenDepth = Math.max(0, parenDepth - 1);

        // Track quote state
        if (char === '"' || char === '“' || char === '”') {
            insideQuote = !insideQuote;
        }

        // Only consider ., !, ? as sentence boundary if not inside quotes
        if ((char === "." || char === "!" || char === "?") && parenDepth === 0 && !insideQuote) {
            // Skip ellipsis "..." or ".."
            if (text[i + 1] === "." || text[i - 1] === ".") continue;

            // Skip decimal numbers
            const prevChar = text[i - 1] || "";
            const nextChar = text[i + 1] || "";
            if (/\d/.test(prevChar) && /\d/.test(nextChar)) continue;

            // Skip abbreviations
            const beforeDot = buffer.slice(0, -1).trim();
            const tokens = beforeDot.split(/\s+/);
            const lastToken = tokens.length ? tokens[tokens.length - 1] : "";
            const lastTokenLower = (lastToken + ".").toLowerCase();
            if (ABBREVIATIONS_LOWER.includes(lastTokenLower)) continue;

            // Split sentence
            sentences.push(buffer.trim());
            buffer = "";
        }
    }

    if (buffer.trim()) sentences.push(buffer.trim());

    // Remove noise prefixes
    const cleanedSentences = sentences.map(s =>
        removeCategoryPrefixes(removeTimePrefixes(s))
    );

    // Merge dangling fragments
    const mergedSentences = mergedRelatedSentences(cleanedSentences);

    //orignal sentences 
    const originalSentences = [...mergedSentences];

    //Resolve pronuns
    const resolved = resolvePronouns(mergedSentences);

    // Filter blocklisted sentences with resolved pronouns
    const filtered = resolved.filter(sentence => !FILTER_BLOCKLIST.some(re => re.test(sentence)));

    // ---- FILTER CLAIMS ----
    return filtered
        .map((resolvedSentence, idx) => {

            const originalSentence = originalSentences[idx] || resolvedSentence;

            const trimmed = resolvedSentence.trim();

            if (trimmed.startsWith('"') && trimmed.endsWith('"')) return null;
            if (trimmed.startsWith('“') && trimmed.endsWith('”')) return null;

            if (isQuoted(trimmed)) return null;
            if (!isClaim(trimmed)) return null;

            return {
                originalClaim: originalSentence,
                resolvedClaim: resolvedSentence,

                label: "claim",
                score: scoreClaim(resolvedSentence)
            };
        })
        .filter(Boolean);
}

//save to mongo
export const createClaimDocuments = async (claimsArray) => {
    if (!claimsArray.length) return [];

    // Convert classification objects → DB objects
    const docs = claimsArray.map(c => ({
        originalClaim: c.originalClaim,
        resolvedClaim: c.resolvedClaim,
        label: c.label,
        score: c.score,
        createdAt: new Date()
    }));

    return await Claim.insertMany(docs);
};

//old controller
export const processNewsArticle = async (req, res) => {
    try {
        const { text, url } = req.body;

        if (!text && !url) {
            return res.status(400).json({ error: "Missing text or URL" });
        }

        let pageText = "";

        // 1) Prefer frontend text (faster, avoids scraping)
        if (text && text.trim().length > 0) {
            pageText = text.trim();
        }

        // 2) If no text provided → scrape from URL
        else if (url) {
            pageText = await extractPageData(url);
        }

        // Still no text → cannot proceed
        if (!pageText || pageText.trim().length < 30) {
            return res.json({
                message: "No article text extracted",
                claims: []
            });
        }

        // 3) Extract claims
        const claims = extractClaimsFromText(pageText);

        if (!claims.length) {
            return res.json({ message: "No claims found on this page", claims: [] });
        }

        // 4) Save to DB
        const saved = await createClaimDocuments(claims);

        return res.json({
            rawClaims: saved
        });

    } catch (error) {
        console.error("Processing error:", error);
        return res.status(500).json({ error: "Failed to process article" });
    }
};

//main controller
export const processChunks = async (req, res) => {
    try {
        const { chunks } = req.body;

        if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
            return res.status(400).json({ error: "No chunks provided" });
        }

        let allText = chunks
            .map(c => (typeof c === "string" ? c.trim() : ""))
            .filter(c => c.length > 0)
            .join(" ");

        // Not enough text to process
        if (!allText || allText.trim().length < 30) {
            return res.json({
                message: "No valid text extracted from chunks",
                claims: []
            });
        }

        // Extract claims (same as processNewsArticle)
        const claims = extractClaimsFromText(allText);

        if (!claims.length) {
            return res.json({
                message: "No claims found in these chunks",
                claims: []
            });
        }

        // Save claims to Mongo
        const saved = await createClaimDocuments(claims);

        return res.json({
            rawClaims: saved
        });

    } catch (error) {
        console.error("Chunk processing error:", error);
        return res.status(500).json({ error: "Failed to process chunks" });
    }
};
