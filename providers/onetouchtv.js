const fetch = global.fetch || require('node-fetch'); // Use global fetch if exists
const CryptoJS = require('crypto-js');

const API_BASE = "https://api.onetouchtv.me"; // Official OneTouchTV API
const HEX_KEY = "4f6e65546f7563685465564b6579"; // Cloudstream AES key

function decryptAES(data) {
    try {
        const key = CryptoJS.enc.Hex.parse(HEX_KEY);
        const decrypted = CryptoJS.AES.decrypt(data, key, {
            mode: CryptoJS.mode.ECB,
            padding: CryptoJS.pad.Pkcs7
        });
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (e) {
        console.error("OneTouchTV decrypt error:", e);
        return null;
    }
}

async function fetchTMDBTitle(tmdbId, mediaType) {
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=b030404650f279792a8d3287232358e3`;
    const res = await fetch(url);
    const json = await res.json();
    return {
        title: json.title || json.name || json.original_title,
        year: (json.release_date || json.first_air_date || "").substring(0, 4)
    };
}

async function fetchEpisodeId(title, season, episode, mediaType) {
    const searchUrl = `${API_BASE}/v1/search?q=${encodeURIComponent(title)}`;
    const res = await fetch(searchUrl, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    const data = await res.json();
    if (!data || !data.results) return null;

    let matched = data.results.find(x => x.title.toLowerCase() === title.toLowerCase());
    if (!matched) matched = data.results[0];
    if (!matched) return null;

    if (mediaType === "movie") return matched.id;

    // TV episode
    const detailRes = await fetch(`${API_BASE}/v1/tv/${matched.id}`);
    const detail = await detailRes.json();
    const ep = detail.episodes.find(e => parseInt(e.number) === parseInt(episode));
    return ep ? ep.id : null;
}

async function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    try {
        const { title } = await fetchTMDBTitle(tmdbId, mediaType);

        const episodeId = await fetchEpisodeId(title, seasonNum, episodeNum, mediaType);
        if (!episodeId) return [];

        const apiUrl = `${API_BASE}/v1/source?id=${episodeId}`;
        const res = await fetch(apiUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Referer": "https://onetouchtv.me/",
                "Origin": "https://onetouchtv.me"
            }
        });
        const json = await res.json();

        if (!json.data) return [];

        const decrypted = decryptAES(json.data);
        if (!decrypted) return [];

        const sources = JSON.parse(decrypted);

        const streams = [];

        if (sources.sources && Array.isArray(sources.sources)) {
            sources.sources.forEach(s => {
                if (!s.file) return;
                streams.push({
                    name: "OneTouchTV",
                    title: s.title || "Server",
                    url: s.file,
                    quality: s.label || "HD",
                    headers: { Referer: "https://onetouchtv.me/" },
                    provider: "onetouchtv"
                });
            });
        }

        return streams;

    } catch (e) {
        console.error("OneTouchTV provider error:", e);
        return [];
    }
}

// Flat export for your loader
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
