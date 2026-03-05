console.log("[UHDMovies] Loaded");

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DOMAIN = "https://uhdmovies.tips";

function makeRequest(url) {
    return fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "text/html,application/xhtml+xml",
            "Referer": DOMAIN
        }
    }).then(r => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
    });
}

function extractPostUrl(html) {

    const match = html.match(/<a[^>]+href="(https:\/\/uhdmovies[^"]+)"[^>]*>\s*<h2/i);

    if (match) return match[1];

    const alt = html.match(/<a href="(https:\/\/uhdmovies[^"]+)" rel="bookmark"/i);

    return alt ? alt[1] : null;
}

function extractDownloadLinks(html) {

    const links = [];

    const regex = /<a[^>]+href="(https?:\/\/[^"]+)"/gi;

    let m;

    while ((m = regex.exec(html)) !== null) {

        const url = m[1];

        if (
            url.includes("driveleech") ||
            url.includes("gdflix") ||
            url.includes("hubdrive") ||
            url.includes("pixeldrain") ||
            url.includes("1fichier") ||
            url.includes("gdtot")
        ) {

            links.push({
                name: "UHDMovies",
                title: "UHDMovies Link",
                url: url,
                quality: "HD",
                provider: "uhdmovies"
            });

        }
    }

    return links;
}

async function scrape(title, year) {

    const searchUrl = `${DOMAIN}/?s=${encodeURIComponent(title + " " + year)}`;

    console.log("[UHDMovies] search:", searchUrl);

    const searchHtml = await makeRequest(searchUrl).catch(() => null);

    if (!searchHtml) return [];

    const postUrl = extractPostUrl(searchHtml);

    if (!postUrl) {
        console.log("[UHDMovies] no post found");
        return [];
    }

    console.log("[UHDMovies] post:", postUrl);

    const pageHtml = await makeRequest(postUrl).catch(() => null);

    if (!pageHtml) return [];

    const results = extractDownloadLinks(pageHtml);

    console.log("[UHDMovies] links:", results.length);

    return results;
}

function getStreams(tmdbId, mediaType = "movie", season = null, episode = null) {

    const tmdb = `https://api.themoviedb.org/3/${mediaType === "tv" ? "tv" : "movie"}/${tmdbId}?api_key=${TMDB_API_KEY}`;

    return fetch(tmdb)
        .then(r => r.json())
        .then(meta => {

            const title = mediaType === "tv" ? meta.name : meta.title;
            const year = mediaType === "tv"
                ? meta.first_air_date?.slice(0, 4)
                : meta.release_date?.slice(0, 4);

            if (!title) return [];

            return scrape(title, year);

        })
        .catch(() => []);
}

if (typeof module !== "undefined") {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
