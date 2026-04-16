// ============================================================
// Einthusan Provider for Nuvio (Updated)
// Version: 1.1.0
// ============================================================

var BASE_URL = 'https://einthusan.tv';

// Updated headers to match the working Android WebView request
var HEADERS = {
  'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36',
  'Origin': 'https://einthusan.tv',
  'Referer': 'https://einthusan.tv/',
  'Accept': '*/*',
  'X-Requested-With': 'XMLHttpRequest'
};

var LANG_SLUGS = ['hindi', 'tamil', 'telugu', 'malayalam', 'kannada', 'bengali', 'marathi', 'punjabi'];

function stripTags(html) {
  return html.replace(/<[^>]*>/g, '').trim();
}

// ── Step 1: Search Einthusan ───────────────────────────────
function searchEinthusan(title, lang) {
  return new Promise(function (resolve) {
    var searchUrl = BASE_URL + '/movie/results/?lang=' + lang + '&find=Search&title=' + encodeURIComponent(title);

    fetch(searchUrl, { headers: HEADERS })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        var pattern = /href="\/movie\/watch\/(\d+)\/\?lang=([^"]+)"/;
        var match = html.match(pattern);

        if (!match) {
          resolve(null);
          return;
        }

        resolve({
          id: match[1],
          lang: match[2]
        });
      })
      .catch(function () { resolve(null); });
  });
}

// ── Step 2: Get stream URL (Updated Regex) ────────────────
function getStreamFromMoviePage(movieId, lang) {
  return new Promise(function (resolve) {
    var watchUrl = BASE_URL + '/movie/watch/' + movieId + '/?lang=' + lang;
    
    // Using the specific Android headers for the page request
    fetch(watchUrl, { headers: HEADERS })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        
        // Updated regex to ensure we capture the full URL including MD5 and expiry tokens
        // Matches: https://...m3u8?e=123&md5=abc
        var streamPattern = /["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i;
        var match = html.match(streamPattern);

        if (match) {
          var streamUrl = match[1];
          resolve([{
            url: streamUrl,
            quality: 'HD',
            format: streamUrl.includes('m3u8') ? 'm3u8' : 'mp4'
          }]);
        } else {
          resolve([]);
        }
      })
      .catch(function () { resolve([]); });
  });
}

function getTmdbTitle(tmdbId, mediaType) {
  return new Promise(function (resolve) {
    var tmdbUrl = 'https://api.themoviedb.org/3/' + mediaType + '/' + tmdbId + '?language=en-US&api_key=4ef0d7355d9ffb5151e987764708ce96';
    fetch(tmdbUrl)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        resolve(data.title || data.name || null);
      })
      .catch(function () { resolve(null); });
  });
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
  return new Promise(function (resolve) {
    getTmdbTitle(tmdbId, mediaType)
      .then(function (title) {
        if (!title) return resolve([]);

        var searchPromises = LANG_SLUGS.map(function (lang) {
          return searchEinthusan(title, lang);
        });

        Promise.all(searchPromises)
          .then(function (results) {
            var best = results.find(function (r) { return r !== null; });
            if (!best) return resolve([]);
            return getStreamFromMoviePage(best.id, best.lang);
          })
          .then(function (streams) {
            resolve(streams || []);
          })
          .catch(function () { resolve([]); });
      });
  });
}

module.exports = { getStreams: getStreams };
