import axios from "axios";

export async function callPythonVerifyAll() {
    try {
        const res = await axios.post("http://localhost:8000/fact-check/all");
        return res.data.results;
    } catch (err) {
        console.error("LLM API ERROR (VerifyAll):", {
            message: err.message,
            code: err.code,
            response: err.response?.data,
            url: err.config?.url
        });
        return [];
    }
}

export async function verifySingleClaim(claimText) {
    try {
        const res = await axios.post("http://localhost:8000/fact-check", { claim: claimText });
        return res.data;
    } catch (err) {
        console.error("LLM API ERROR (Single):", err.message, err.response?.data);
        return null;
    }
}
