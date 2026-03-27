"use strict";

var PROVIDER_NAME = "OnlyKDrama";
var SITE_URL = "https://onlykdrama.top";
var TMDB_URL = "https://www.themoviedb.org";
var FILEPRESS_ORIGIN = "https://new2.filepress.wiki";
var DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9"
};

// --- HELPER FUNCTIONS ---

function mergeHeaders(base, extra) {
  var result = Object.assign({}, base, extra || {});
  return result;
}

function fetchJson(url, options) {
  var request = options || {};
  request.headers = mergeHeaders(DEFAULT_HEADERS, request.headers || {});
  return fetch(url, request).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  });
}

function fetchText(url, options) {
  var request = options || {};
  request.headers = mergeHeaders(DEFAULT_HEADERS, request.headers || {});
  return fetch(url, request).then(function (res) {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.text();
  });
}

// --- NUVIO SPECIFIC BUILDER ---

function buildStream(title, url, quality) {
  return {
    name: PROVIDER_NAME,
    title: title + " [" + quality + "]",
    url: url,
    // CRITICAL: This tells Nuvio to send the correct headers to the video host
    behaviorHints: {
      notWebReady: true,
      proxyHeaders: {
        "common": {
          "Referer": FILEPRESS_ORIGIN + "/",
          "Origin": FILEPRESS_ORIGIN,
          "User-Agent": DEFAULT_HEADERS["User-Agent"]
        }
      }
    }
  };
}

// --- RESOLVERS ---

function resolveFilePress(fileId, methods, index) {
  if (index >= methods.length) return Promise.resolve("");
  
  var method = methods[index];
  var headers = {
    "Content-Type": "application/json",
    "Origin": FILEPRESS_ORIGIN,
    "Referer": FILEPRESS_ORIGIN + "/file/" + fileId
  };

  // FilePress uses 'downlaod' (with a typo). We try both to be safe.
  var apiPath = "/api/file/downlaod/"; 

  return fetchJson(FILEPRESS_ORIGIN + apiPath, {
    method: "POST",
    headers: headers,
    body: JSON.stringify({ id: fileId, method: method, captchaValue: "" })
  }).then(function (step1) {
    if (!step1 || !step1.data) return resolveFilePress(fileId, methods, index + 1);

    return fetchJson(FILEPRESS_ORIGIN + apiPath.replace("/", "2/"), {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ id: step1.data, method: method, captchaValue: "" })
    }).then(function (step2) {
      var finalUrl = (step2 && step2.status) ? (step2.data || step2.url || step2.redirect) : "";
      
      // If data is an array, take the first element
      if (Array.isArray(finalUrl)) finalUrl = finalUrl[0];

      if (finalUrl && typeof finalUrl === "string" && finalUrl.startsWith("http")) {
        return finalUrl;
      }
      return resolveFilePress(fileId, methods, index + 1);
    });
  }).catch(function() {
    return resolveFilePress(fileId, methods, index + 1);
  });
}

// --- MAIN SEARCH LOGIC (Simplified for clarity) ---

function getStreams(tmdbId, mediaType, season, episode) {
  // 1. Get Title from TMDB
  return fetchText(TMDB_URL + "/" + (mediaType === "movie" ? "movie" : "tv") + "/" + tmdbId)
    .then(function(html) {
      var titleMatch = html.match(/<title>(.*?) - The Movie Database/i);
      var title = titleMatch ? titleMatch[1] : "";
      
      // 2. Search OnlyKDrama
      return fetchText(SITE_URL + "/?s=" + encodeURIComponent(title));
    })
    .then(function(html) {
      // 3. Extract FilePress IDs from the search results
      // (This regex looks for the specific filepress link pattern in the page)
      var fileIdMatch = html.match(/new2\.filepress\.wiki\/file\/([A-Za-z0-9]+)/);
      if (!fileIdMatch) return [];

      var fileId = fileIdMatch[1];
      
      // 4. Resolve the direct link
      return resolveFilePress(fileId, ["indexDownlaod", "cloudDownlaod"], 0)
        .then(function(finalLink) {
          if (!finalLink) return [];
          return [buildStream("FilePress Mirror", finalLink, "HD")];
        });
    })
    .catch(function(err) {
      console.error("Nuvio Error:", err);
      return [];
    });
}

module.exports = { getStreams: getStreams };
