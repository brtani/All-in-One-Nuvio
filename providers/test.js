// Dahmer Movies Scraper for Nuvio

console.log('[DahmerMovies] Init');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const BASE = "https://a.111477.xyz";

// REQUEST
function makeRequest(url) {
    return fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*"
        }
    }).then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r;
    });
}

// PARSE HTML LINKS
function parseLinks(html) {
    const links = [];
    const regex = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let m;

    while ((m = regex.exec(html))) {
        const href = m[1];
        const text = m[2].trim();

        if (!text || text === "../") continue;

        links.push({ href, text });
    }

    return links;
}

// QUALITY
function getQuality(text) {
    const m = text.match(/(\d{3,4})p/i);
    return m ? parseInt(m[1]) : 0;
}

// MAIN SCRAPER
function invoke(title, year, season = null, episode = null) {

    const url = season === null
        ? `${BASE}/movies/${encodeURIComponent(title + " (" + year + ")")}/`
        : `${BASE}/tvs/${encodeURIComponent(title)}/Season ${season}/`;

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

                // ✅ FIXED URL HANDLING (NO DOUBLE ENCODING)
                if (l.href.startsWith("http")) {
                    finalUrl = l.href;
                } else {
                    // IMPORTANT: prevent /movies duplication + %2520 issue
                    const cleanHref = l.href.startsWith("/") ? l.href : "/" + l.href;

                    finalUrl = BASE + cleanHref;
                }

                console.log("FINAL URL:", finalUrl);

                return {
                    name: "DahmerMovies",
                    title: l.text,
                    url: finalUrl,
                    quality: getQuality(l.text),

                    // FIXED HEADERS (ExoPlayer + Wuffy compatible)
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                        "Referer": BASE + "/",
                        "Origin": BASE,
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

// TMDB WRAPPER
function getStreams(id, type = "movie", season = null, episode = null) {

    const url = `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_API_KEY}`;

    return makeRequest(url)
        .then(r => r.json())
        .then(d => {

            const title = type === "tv" ? d.name : d.title;
            const date = type === "tv" ? d.first_air_date : d.release_date;
            const year = date ? date.slice(0, 4) : "";

            return invoke(title, year, season, episode);
        })
        .catch(() => []);
}

// EXPORT
if (typeof module !== "undefined") {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
