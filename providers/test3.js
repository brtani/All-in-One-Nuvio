var PRIMESRC_API = "https://primesrc.me/api/v1/";

function getStreams(id, mediaType, season, episode) {
    var isImdb = (typeof id === 'string' && id.indexOf('tt') === 0);
    var type = (season && episode) ? "tv" : "movie";
    
    var searchUrl = PRIMESRC_API + "list_servers?type=" + type;
    searchUrl += isImdb ? ("&imdb=" + id) : ("&tmdb=" + id);
    if (type === "tv") searchUrl += "&season=" + season + "&episode=" + episode;

    // The "Magic" User-Agent from your logs
    var androidUA = "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36";

    return fetch(searchUrl, {
        headers: { "User-Agent": androidUA, "Referer": "https://primesrc.me/" }
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (!data || !data.servers) return [];

        var results = [];
        for (var i = 0; i < data.servers.length; i++) {
            var s = data.servers[i];
            
            var p = fetch(PRIMESRC_API + "l?key=" + s.key, {
                headers: { "User-Agent": androidUA, "Referer": "https://primesrc.me/" }
            })
            .then(function(res) { return res.json(); })
            .then(function(ld) {
                if (!ld || !ld.link) return null;

                var streamUrl = ld.link;
                
                // --- DYNAMIC HEADER MATCHING ---
                var streamHeaders = {
                    "User-Agent": androidUA,
                    "Accept": "*/*",
                    "sec-ch-ua-platform": "Android",
                    "sec-ch-ua-mobile": "?1"
                };

                // Apply the exact Referer/Origin logic from your logs
                if (streamUrl.indexOf("streamta.site") !== -1) {
                    streamHeaders["Referer"] = "https://streamta.site/";
                    streamHeaders["Origin"] = "https://streamta.site";
                } else if (streamUrl.indexOf("cloudatacdn.com") !== -1) {
                    streamHeaders["Referer"] = "https://playmogo.com/";
                } else if (streamUrl.indexOf("tapecontent.net") !== -1) {
                    streamHeaders["Referer"] = "https://streamta.site/";
                    streamHeaders["Origin"] = "https://streamta.site";
                } else {
                    streamHeaders["Referer"] = "https://primesrc.me/";
                }

                return {
                    name: "PrimeSrc: " + (s.name || "Server"),
                    url: streamUrl,
                    quality: "1080p",
                    headers: streamHeaders,
                    provider: "primesrc"
                };
            })
            .catch(function() { return null; });

            results.push(p);
        }

        return Promise.all(results).then(function(final) {
            return final.filter(function(item) { return item !== null; });
        });
    })
    .catch(function() { return []; });
}

if (typeof module !== 'undefined') module.exports = { getStreams: getStreams };
