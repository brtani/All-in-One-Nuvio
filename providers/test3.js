// PrimeSrc Scraper - Header-Matched Version
const PRIMESRC_BASE = "https://primesrc.me/api/v1/";
const PRIMESRC_SITE = "https://primesrc.me";

function getStreams(id, mediaType, season, episode) {
    var isImdb = (typeof id === 'string' && id.indexOf('tt') === 0);
    var type = (season && episode) ? "tv" : "movie";
    
    var url = PRIMESRC_BASE + "list_servers?type=" + type;
    url += isImdb ? ("&imdb=" + id) : ("&tmdb=" + id);
    if (type === "tv") url += "&season=" + season + "&episode=" + episode;

    // These headers mimic the successful playback environment you shared
    var baseHeaders = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36",
        "Referer": PRIMESRC_SITE + "/",
        "X-Requested-With": "com.nuvio.app" // Common for Android WebView streamers
    };

    return fetch(url, { headers: baseHeaders })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
        if (!data || !data.servers) return [];

        var promises = data.servers.map(function(server) {
            return fetch(PRIMESRC_BASE + "l?key=" + server.key, { headers: baseHeaders })
            .then(function(res) { return res.json(); })
            .then(function(linkData) {
                if (!linkData || !linkData.link) return null;

                var finalUrl = linkData.link;
                var streamHeaders = {
                    "User-Agent": baseHeaders["User-Agent"],
                    "Accept": "*/*",
                    "Accept-Encoding": "identity;q=1, *;q=0",
                    "sec-ch-ua-platform": "Android",
                    "sec-ch-ua-mobile": "?1"
                };

                // DYNAMIC REFERER LOGIC
                // Based on your logs, different hosts need different referers
                if (finalUrl.indexOf("streamta.site") !== -1) {
                    streamHeaders["Referer"] = "https://streamta.site/";
                    streamHeaders["Origin"] = "https://streamta.site";
                } else if (finalUrl.indexOf("cloudatacdn.com") !== -1) {
                    streamHeaders["Referer"] = "https://playmogo.com/";
                } else {
                    streamHeaders["Referer"] = PRIMESRC_SITE + "/";
                }

                return {
                    name: "PrimeSrc - " + (server.name || "HD"),
                    url: finalUrl,
                    quality: "1080p",
                    headers: streamHeaders,
                    provider: "primesrc"
                };
            })
            .catch(function() { return null; });
        });

        return Promise.all(promises).then(function(results) {
            return results.filter(function(s) { return s !== null; });
        });
    })
    .catch(function() { return []; });
}

if (typeof module !== 'undefined') module.exports = { getStreams: getStreams };
