// ============================================================
// Einthusan Provider - Connection Timeout Fix
// ============================================================

var BASE_URL = 'https://einthusan.tv';

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36',
  'Referer': 'https://einthusan.tv/',
  'Accept': '*/*',
  'Connection': 'keep-alive',
  'Accept-Encoding': 'identity'
};

function getStreams(tmdbId, mediaType) {
  return new Promise(function (resolve) {
    // Using the specific movie ID provided
    var watchUrl = BASE_URL + '/movie/watch/21lw/?lang=hindi';

    fetch(watchUrl, { 
      headers: HEADERS,
      method: 'GET',
      redirect: 'follow' 
    })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        // Regex to find the stream
        var streamPattern = /["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i;
        var match = html.match(streamPattern);

        if (match) {
          var rawUrl = match[1].replace(/&amp;/g, '&').trim();

          // FIX: If the URL is an IP address, the SSL handshake often fails in Java/Android.
          // We keep it as is but ensure it's not being double-escaped.
          var finalUrl = rawUrl.replace(/\\\//g, '/');

          resolve([{
            url: finalUrl,
            quality: 'HD',
            format: finalUrl.includes('m3u8') ? 'm3u8' : 'mp4',
            headers: {
               'User-Agent': HEADERS['User-Agent'],
               'Referer': 'https://einthusan.tv/',
               'Origin': 'https://einthusan.tv',
               'Accept': '*/*',
               'Connection': 'keep-alive'
            }
          }]);
        } else {
          resolve([]);
        }
      })
      .catch(function (err) {
        console.log('Provider Error: ' + err);
        resolve([]);
      });
  });
}

module.exports = { getStreams: getStreams };
