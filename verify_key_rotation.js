import { searchText } from "./services/searchText.js";

// Mock environment variables
process.env.GOOGLE_API_KEY = "KEY_1,KEY_2,KEY_3";
process.env.GOOGLE_SEARCH_ENGINE_ID = "TEST_CX";

// Mock global fetch
const originalFetch = global.fetch;
let fetchCallCount = 0;

global.fetch = async (url) => {
    fetchCallCount++;
    const urlObj = new URL(url);
    const key = urlObj.searchParams.get("key");

    console.log(`Fetch attempt #${fetchCallCount} with key: ${key}`);

    if (key === "KEY_1") {
        console.log("Simulating 429 Too Many Requests for KEY_1");
        return {
            ok: false,
            status: 429,
            text: async () => "Quota Exceeded",
            json: async () => ({})
        };
    }

    if (key === "KEY_2") {
        console.log("Simulating 403 Forbidden for KEY_2");
        return {
            ok: false,
            status: 403,
            text: async () => "Forbidden",
            json: async () => ({})
        };
    }

    if (key === "KEY_3") {
        console.log("Success with KEY_3");
        return {
            ok: true,
            status: 200,
            json: async () => ({
                items: [
                    { title: "Test Result", link: "http://example.com", snippet: "Test snippet" }
                ]
            })
        };
    }

    return {
        ok: false,
        status: 500,
        text: async () => "Unknown Error",
        json: async () => ({})
    };
};

async function testRotation() {
    console.log("Starting API Key Rotation Test...");
    const results = await searchText("test query");

    console.log("\nTest Results:");
    console.log("Results found:", results.length);

    if (results.length > 0 && results[0].title === "Test Result") {
        console.log("✅ SUCCESS: Retrieved results after rotation.");
    } else {
        console.log("❌ FAILURE: Did not retrieve results.");
    }

    if (fetchCallCount === 3) {
        console.log("✅ SUCCESS: Tried 3 keys.");
    } else {
        console.log(`❌ FAILURE: Expected 3 fetch calls, got ${fetchCallCount}.`);
    }

    // Restore fetch
    global.fetch = originalFetch;
}

testRotation();
