// ============================================================
// Einthusan Fixed Provider
// ============================================================

var BASE_URL = 'https://einthusan.tv';

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36',
  'Referer': 'https://einthusan.tv/',
  'Origin': 'https://einthusan.tv'
};

function getStreams(tmdbId, mediaType) {
  return new Promise(function (resolve) {
    // Using the specific movie ID from your link
    var watchUrl = BASE_URL + '/movie/watch/21lw/?lang=hindi';

    fetch(watchUrl, { headers: HEADERS })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        // Find the stream link
        var streamPattern = /["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i;
        var match = html.match(streamPattern);

        if (match) {
          // Clean the HTML entities and remove trailing slashes/quotes
          var rawUrl = match[1].replace(/&amp;/g, '&').replace(/["']/g, '');
          
          resolve([{
            url: rawUrl,
            quality: 'HD',
            format: rawUrl.includes('m3u8') ? 'm3u8' : 'mp4',
            // Explicitly passing headers for the PLAYER to use
            headers: {
               'User-Agent': HEADERS['User-Agent'],
               'Referer': 'https://einthusan.tv/',
               'Origin': 'https://einthusan.tv'
            }
          }]);
        } else {
          resolve([]);
        }
      })
      .catch(function () { resolve([]); });
  });
}

module.exports = { getStreams: getStreams };
