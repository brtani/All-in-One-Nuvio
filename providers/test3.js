const TMDB_API_KEY = "20bf0a5cbc307e7889137457fa5b6b37";
const XPRIME_BACKEND = "https://backend.xprime.tv";

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json, */*",
  "Referer": "https://xprime.stream/",
  "Origin": "https://xprime.stream"
};

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  mediaType = mediaType || "movie";
  
  // 1. Get the IMDb ID from TMDB (Backends usually need tt1234567, not just numbers)
  var tmdbUrl = "https://api.themoviedb.org/3/" + (mediaType === "tv" ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + TMDB_API_KEY + "&append_to_response=external_ids";

  return fetch(tmdbUrl, { headers: { "Accept": "application/json" } })
    .then(function(res) { return res.json(); })
    .then(function(tmdbData) {
      var title = mediaType === "tv" ? tmdbData.name : tmdbData.title;
      // Get the 'tt' ID. If it's not there, stick to the tmdbId.
      var queryId = (tmdbData.external_ids && tmdbData.external_ids.imdb_id) || tmdbId;
      
      var backendUrl = mediaType === "movie" 
        ? XPRIME_BACKEND + "/primebox?id=" + queryId + "&type=movie&name=" + encodeURIComponent(title) 
        : XPRIME_BACKEND + "/primebox?id=" + queryId + "&type=tv&name=" + encodeURIComponent(title) + "&season=" + (seasonNum || 1) + "&episode=" + (episodeNum || 1);
      
      return fetch(backendUrl, { headers: DEFAULT_HEADERS });
    })
    .then(function(res) { return res.json(); })
    .then(function(backendData) {
      var streams = [];
      // Parse the results
      var sources = Array.isArray(backendData) ? backendData : (backendData.streams || (backendData.url ? [backendData] : []));
      
      sources.forEach(function(src) {
        // ONLY add the link if it's a real video (doesn't contain the website 'watch' path)
        if (src.url && src.url.indexOf('/watch/') === -1) {
          streams.push({
            name: "XPrime - " + (src.quality || "HD"),
            url: src.url,
            quality: src.quality || "Auto",
            // ExoPlayer needs these to bypass the 403 error
            headers: {
              "User-Agent": DEFAULT_HEADERS["User-Agent"],
              "Referer": "https://xprime.stream/",
              "Origin": "https://xprime.stream"
            },
            provider: "xprime",
            subtitles: (src.subtitles || []).map(function(s) {
              return { url: s.file || s.url, lang: s.label || "English" };
            })
          });
        }
      });

      return streams; 
    })
    .catch(function() {
      return [];
    });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { getStreams };
}
