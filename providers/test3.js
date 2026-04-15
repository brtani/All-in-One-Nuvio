// PrimeSrc Scraper for Nuvio
// Identical structure to working version - Added Embed Flags

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

    // UA matching your successful mobile playback
    var ua = "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36";

    return fetch(url, {
        headers: {
            "User-Agent": ua,
            "Referer": PRIMESRC_SITE + "/"
        }
    })
    .then(function(response) {
        if (!response.ok) throw new Error("HTTP " + response.status);
        return response.json();
    })
    .then(function(data) {
        if (!data || !data.servers || !Array.isArray(data.servers)) {
            return [];
        }

        return data.servers.map(function(server) {
            var embedUrl = PRIMESRC_SITE + "/embed/" + type + "?";
            if (typeof id === 'string' && id.startsWith('tt')) {
                embedUrl += "imdb=" + id;
            } else {
                embedUrl += "tmdb=" + id;
            }

            if (type === "tv") {
                embedUrl += "&season=" + season + "&episode=" + episode;
            }
            
            embedUrl += "&whitelistServers=" + encodeURIComponent(server.name);

            return {
                name: "PrimeSrc - " + server.name,
                url: embedUrl,
                quality: "Auto",
                // This tells the app to use a Browser/Webview instead of ExoPlayer
                renderType: "embed", 
                isEmbed: true,
                headers: { 
                    "User-Agent": ua,
                    "Referer": PRIMESRC_SITE + "/" 
                }
            };
        });
    })
    .catch(function(error) {
        return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { getStreams: getStreams };
} else {
    global.getStreams = getStreams;
}
