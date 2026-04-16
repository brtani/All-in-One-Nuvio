// ============================================================
// Einthusan Provider - Header Pipe Version (Fixes Spinning)
// ============================================================

var BASE_URL = 'https://einthusan.tv';

var UA = 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36';

function getStreams(tmdbId, mediaType) {
  return new Promise(function (resolve) {
    // Testing specifically with movie ID 21lw
    var watchUrl = BASE_URL + '/movie/watch/21lw/?lang=hindi';

    fetch(watchUrl, { 
      headers: {
        'User-Agent': UA,
        'Referer': 'https://einthusan.tv/'
      }
    })
    .then(function (res) { return res.text(); })
    .then(function (html) {
      // Logic to find the link in the HTML
      var match = html.match(/["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i);

      if (match && match[1]) {
        var rawUrl = match[1].replace(/&amp;/g, '&').replace(/\\/g, '').trim();

        // --- THE "BULLETPROOF" FIX ---
        // We append the headers directly to the URL string. 
        // Many Android players (VLC, ExoPlayer) use this to bypass blocks.
        var pipedUrl = rawUrl + '|User-Agent=' + encodeURIComponent(UA) + '&Referer=' + encodeURIComponent('https://einthusan.tv/');

        console.log('SUCCESS: Link with Pipe -> ' + pipedUrl);

        resolve([{
          url: pipedUrl, // This version carries its own authorization
          quality: 'HD',
          format: pipedUrl.indexOf('m3u8') !== -1 ? 'm3u8' : 'mp4',
          headers: {
            'User-Agent': UA,
            'Referer': 'https://einthusan.tv/'
          }
        }]);
      } else {
        console.log('FAIL: No link in HTML');
        resolve([]);
      }
    })
    .catch(function (err) {
      console.log('FETCH ERROR: ' + err);
      resolve([]);
    });
  });
}

module.exports = { getStreams: getStreams };
