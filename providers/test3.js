const PRIMESRC_BASE = "https://primesrc.me/api/v1/";
const PRIMESRC_SITE = "https://primesrc.me";

function getStreams(id, mediaType, season, episode) {
    var type = (season && episode) ? "tv" : "movie";
    var url = PRIMESRC_BASE + "list_servers?type=" + type;

    if (typeof id === 'string' && id.startsWith('tt')) {
        url += "&imdb=" + id;
    } else {
        url += "&tmdb=" + id;
    }

    if (type === "tv") {
        url += "&season=" + season + "&episode=" + episode;
    }

    // Standard headers to prevent 403 Forbidden
    var requestHeaders = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36",
        "Referer": PRIMESRC_SITE + "/"
    };

    return fetch(url, { headers: requestHeaders })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (!data || !data.servers) return [];

        // We must fetch the actual 'l' (link) for each server to get the file
        var linkPromises = data.servers.map(function(server) {
            // According to common PrimeSrc patterns, the link endpoint is 'l'
            return fetch(PRIMESRC_BASE + "l?key=" + server.key, { headers: requestHeaders })
            .then(function(res) { return res.json(); })
            .then(function(linkData) {
                if (!linkData || !linkData.link) return null;

                // Return the direct video file link
                return {
                    name: "PrimeSrc - " + server.name,
                    url: linkData.link, 
                    quality: "1080p",
                    // Some links require the Referer to play in ExoPlayer
                    headers: { 
                        "Referer": PRIMESRC_SITE + "/",
                        "User-Agent": "Mozilla/5.0 (Linux; Android 10)"
                    },
                    provider: "primesrc"
                };
            })
            .catch(function() { return null; });
        });

        return Promise.all(linkPromises).then(function(results) {
            return results.filter(function(s) { return s !== null; });
        });
    })
    .catch(function() { return []; });
}
