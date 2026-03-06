const BASE = "https://movix.blog";
const TMDB_KEY = "8d6d91784c04f98f6e241852615c441b";

async function safeFetch(url, headers = {}) {
    try {
        const res = await fetch(url, { headers });
        if (!res.ok) return null;
        return await res.text();
    } catch (e) {
        return null;
    }
}

async function getMeta(tmdbId, mediaType) {
    try {

        const type = mediaType === "tv" ? "tv" : "movie";

        const res = await fetch(
            `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`
        );

        const json = await res.json();

        return json.title || json.name || null;

    } catch (e) {
        return null;
    }
}

async function extractStreams(playerUrl, referer) {

    let streams = [];

    const html = await safeFetch(playerUrl, {
        "Referer": referer,
        "User-Agent": "Mozilla/5.0"
    });

    if (!html) return streams;

    const regex = /(https?:\/\/[^"' ]+\.(m3u8|mp4)[^"' ]*)/gi;

    let match;

    while ((match = regex.exec(html)) !== null) {

        streams.push({
            name: "Movix",
            title: "Movix Stream",
            url: match[1],
            quality: "HD",
            source: "Movix",
            headers: {
                Referer: playerUrl,
                "User-Agent": "Mozilla/5.0"
            }
        });

    }

    return streams;
}

async function getStreams(tmdbId, mediaType, season, episode) {

    try {

        const title = await getMeta(tmdbId, mediaType);

        if (!title) return [];

        const searchHtml = await safeFetch(
            `${BASE}/search?q=${encodeURIComponent(title)}`,
            { "User-Agent": "Mozilla/5.0" }
        );

        if (!searchHtml) return [];

        const match =
            searchHtml.match(/href="\/movie\/([^"]+)"/i) ||
            searchHtml.match(/href="\/watch\/([^"]+)"/i);

        if (!match) return [];

        const pageUrl = `${BASE}/movie/${match[1]}`;

        const pageHtml = await safeFetch(pageUrl, {
            Referer: BASE,
            "User-Agent": "Mozilla/5.0"
        });

        if (!pageHtml) return [];

        const iframeRegex = /<iframe[^>]+src="([^"]+)"/gi;

        let iframe;
        let streams = [];

        while ((iframe = iframeRegex.exec(pageHtml)) !== null) {

            const iframeUrl = iframe[1];

            const extracted = await extractStreams(iframeUrl, pageUrl);

            streams.push(...extracted);

        }

        return streams;

    } catch (e) {

        return [];

    }
}

module.exports = { getStreams };
