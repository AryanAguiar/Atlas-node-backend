import dotenv from "dotenv";
dotenv.config();

export async function searchText(query) {
    const url = "https://www.googleapis.com/customsearch/v1";

    // Support multiple keys separated by commas
    const keys = (process.env.GOOGLE_API_KEY || "").split(",").map(k => k.trim()).filter(Boolean);
    const searchEngines = (process.env.GOOGLE_SEARCH_ENGINE_ID || "").split(",").map(k => k.trim()).filter(Boolean);
    if (keys.length === 0) {
        console.error("No Google API keys found.");
        return [];
    }

    let currentKeyIndex = 0;

    for (let attempt = 0; attempt < keys.length; attempt++) {
        const apiKey = keys[currentKeyIndex];

        const params = new URLSearchParams({
            key: apiKey,
            cx: searchEngines[currentKeyIndex],
            q: query,
            num: "5",
        });

        try {
            const res = await fetch(`${url}?${params.toString()}`);

            if (res.ok) {
                const data = await res.json();
                if (!data.items) return [];

                return data.items.map(item => ({
                    title: item.title ?? "",
                    link: item.link ?? "",
                    snippet: item.snippet ?? "",
                }));
            }

            // If rate limited (429) or quota exceeded (403), try next key
            if (res.status === 429 || res.status === 403) {
                const errText = await res.text();
                console.warn(`Google API Error (Key ${currentKeyIndex + 1}): ${res.status} - ${errText}`);
                console.warn(`Switching keys...`);
                currentKeyIndex = (currentKeyIndex + 1) % keys.length;
                continue; // Retry with next key
            }

            console.error("Google API Error:", res.status, await res.text());
            return [];

        } catch (err) {
            console.error("Google API fetch failed:", err);
            return [];
        }
    }

    console.error("All Google API keys exhausted.");
    return [];
}
