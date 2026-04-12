// Dahmer Movies Scraper for Nuvio Local Scrapers

console.log('[DahmerMovies] Initializing Dahmer Movies scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';
const TIMEOUT = 60000;

// QUALITY
const Qualities = {
    Unknown: 0,
    P144: 144,
    P240: 240,
    P360: 360,
    P480: 480,
    P720: 720,
    P1080: 1080,
    P1440: 1440,
    P2160: 2160
};

// REQUEST
function makeRequest(url, options = {}) {
    return fetch(url, {
        timeout: TIMEOUT,
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': '*/*',
            ...options.headers
        },
        ...options
    }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
    });
}

// PARSER
function parseLinks(html) {
    const links = [];
    const regex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let m;

    while ((m = regex.exec(html))) {
        const href = m[1];
        const text = m[2].trim();
        if (!text || text === '../') continue;
        links.push({ href, text });
    }

    return links;
}

// QUALITY
function getQuality(str) {
    const m = str.match(/(\d{3,4})p/i);
    return m ? parseInt(m[1]) : 0;
}

// MAIN
function invoke(title, year, season = null, episode = null) {

    const url = season === null
        ? `${DAHMER_MOVIES_API}/movies/${encodeURIComponent(title + " (" + year + ")")}/`
        : `${DAHMER_MOVIES_API}/tvs/${encodeURIComponent(title)}/Season ${season}/`;

    return makeRequest(url)
        .then(r => r.text())
        .then(html => {

            let links = parseLinks(html);

            // FILTER
            if (season === null) {
                links = links.filter(l => /(1080p|2160p)/i.test(l.text));
            } else {
                const s = season < 10 ? "0" + season : season;
                const e = episode < 10 ? "0" + episode : episode;
                const reg = new RegExp(`S${s}E${e}`, "i");
                links = links.filter(l => reg.test(l.text));
            }

            return links.map(l => {

                let finalUrl;

                // ✅ FIXED: DO NOT rebuild or re-encode paths
                // This prevents /movies duplication + %2520 issues

                if (l.href.startsWith('http')) {
                    finalUrl = l.href;
                } else {
                    // 🔥 CRITICAL FIX: use raw href exactly as provided
                    finalUrl = DAHMER_MOVIES_API + l.href;
                }

                console.log("FINAL URL:", finalUrl);

                return {
                    name: "DahmerMovies",
                    title: l.text,
                    url: finalUrl,
                    quality: getQuality(l.text),

                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                        "Referer": DAHMER_MOVIES_API + "/",
                        "Origin": DAHMER_MOVIES_API,
                        "Accept": "*/*",
                        "Accept-Encoding": "identity",
                        "Connection": "keep-alive",
                        "Range": "bytes=0-"
                    },

                    filename: l.text
                };
            });
        })
        .catch(err => {
            console.log("ERROR:", err.message);
            return [];
        });
}

// TMDB
function getStreams(id, type = "movie", season = null, episode = null) {

    const tmdbUrl = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`;

    return makeRequest(tmdbUrl)
        .then(r => r.json())
        .then(d => {

            const title = type === "tv" ? d.name : d.title;
            const year = type === "tv"
                ? d.first_air_date?.substring(0, 4)
                : d.release_date?.substring(0, 4);

            return invoke(title, year, season, episode);
        })
        .catch(() => []);
}

// EXPORT
if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
