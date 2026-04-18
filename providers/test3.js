const TMDB_API_KEY = "20bf0a5cbc307e7889137457fa5b6b37";

// The "Magic" headers that allow VidPlus playback
const PLAYBACK_HEADERS = {
  "Origin": "https://player.videasy.net",
  "Referer": "https://player.videasy.net/",
  "sec-ch-ua": '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"',
  "sec-ch-ua-mobile": "?1",
  "sec-ch-ua-platform": '"Android"',
  "User-Agent": "Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36",
  "Accept": "*/*",
  "Accept-Encoding": "identity;q=1, *;q=0"
};

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  mediaType = mediaType || "movie";
  var tmdbUrl = "https://api.themoviedb.org/3/" + (mediaType === "tv" ? "tv" : "movie") + "/" + tmdbId + "?api_key=" + TMDB_API_KEY;

  return fetch(tmdbUrl)
    .then(function(res) { return res.json(); })
    .then(function(info) {
      var title = mediaType === "tv" ? info.name : info.title;

      /* THE FIX: We hit the VidSrc API /api/source/ endpoint.
         This returns the actual VidPlus M3U8 link instead of the 404/22004 webpage.
      */
      var apiUrl = "https://vidsrc.wtf/api/source/" + (mediaType === "tv" 
        ? "tv/" + tmdbId + "/" + seasonNum + "/" + episodeNum 
        : "movie/" + tmdbId);

      return fetch(apiUrl, {
        headers: {
          "Referer": "https://vidsrc.wtf/",
          "User-Agent": PLAYBACK_HEADERS["User-Agent"]
        }
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        // Extract the raw .m3u8 link from the API response
        var directUrl = data.url || data.data || "";

        if (!directUrl || directUrl.includes("screenshare")) return [];

        return [{
          name: "VidPlus (RGShows)",
          title: title + (mediaType === "tv" ? " S" + seasonNum + "E" + episodeNum : ""),
          url: directUrl, 
          quality: "1080p",
          headers: PLAYBACK_HEADERS, // Player needs these to play without 403
          provider: "rgshows"
        }];
      });
    })
    .catch(function(err) {
      console.error("[Scraper] Error: " + err.message);
      return [];
    });
}

if (typeof module !== "undefined") module.exports = { getStreams };
