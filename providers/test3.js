/**
 * Nuvio-Compatible PrimeSrc Scraper
 * NO async/await allowed in this environment.
 */

const TMDB_API_KEY = "20bf0a5cbc307e7889137457fa5b6b37";
const PRIMESRC_BASE = "https://primesrc.me/api/v1/";

function getStreams(id, mediaType, season, episode) {
    // 1. Convert IMDB to TMDB if necessary
    var initialPromise;
    if (typeof id === 'string' && id.startsWith('tt')) {
        var findUrl = "https://api.themoviedb.org/3/find/" + id + "?api_key=" + TMDB_API_KEY + "&external_source=imdb_id";
        initialPromise = fetch(findUrl).then(function(r) { return r.json(); }).then(function(data) {
            var res = (data.movie_results && data.movie_results[0]) || (data.tv_results && data.tv_results[0]);
            return res ? { id: res.id, type: data.movie_results.length > 0 ? "movie" : "tv" } : null;
        });
    } else {
        initialPromise = Promise.resolve({ id: id, type: mediaType || (season ? "tv" : "movie") });
    }

    // 2. Main Logic Chain
    return initialPromise.then(function(mapping) {
        if (!mapping) return [];

        var searchUrl = PRIMESRC_BASE + "s?tmdb=" + mapping.id + "&type=" + mapping.type;
        if (mapping.type === "tv") {
            searchUrl += "&season=" + season + "&episode=" + episode;
        }

        // 3. Fetch Servers
        return fetch(searchUrl, {
            headers: { "Referer": "https://primesrc.me/", "User-Agent": "Mozilla/5.0" }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            if (!data || !data.servers) return [];

            // 4. Resolve each server key into a link
            var promises = data.servers.map(function(server) {
                return fetch(PRIMESRC_BASE + "l?key=" + server.key, {
                    headers: { "Referer": "https://primesrc.me/" }
                })
                .then(function(r) { return r.json(); })
                .then(function(linkData) {
                    return {
                        name: "PrimeSrc - " + (server.name || "Direct"),
                        url: linkData.link,
                        quality: "720p/1080p",
                        provider: "primesrc"
                    };
                })
                .catch(function() { return null; });
            });

            return Promise.all(promises).then(function(results) {
                return results.filter(function(s) { return s !== null && s.url; });
            });
        });
    }).catch(function(err) {
        console.error("[PrimeSrc] Fatal Error: " + err.message);
        return [];
    });
}

// Export for Nuvio
if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
