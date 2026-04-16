// ============================================================
// Einthusan Provider - Deep Extraction Version
// ============================================================

var BASE_URL = 'https://einthusan.tv';

var HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36',
  'Referer': 'https://einthusan.tv/',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"'
};

function getStreams(tmdbId, mediaType) {
  return new Promise(function (resolve) {
    // Manually setting the movie ID for testing: 661t
    var watchUrl = BASE_URL + '/movie/watch/661t/?lang=hindi';

    fetch(watchUrl, { headers: HEADERS })
      .then(function (res) { return res.text(); })
      .then(function (html) {
        
        // --- EXTRACTION STRATEGY 1: Direct Link ---
        var regex1 = /["'](https?:\/\/cdn1\.einthusan\.io\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i;
        
        // --- EXTRACTION STRATEGY 2: Encoded/JSON Link ---
        var regex2 = /"url"\s*:\s*"([^"]+\.(?:m3u8|mp4)[^"]*)"/i;

        var match = html.match(regex1) || html.match(regex2);

        if (match) {
          var streamUrl = match[1].replace(/&amp;/g, '&').replace(/\\/g, '').trim();
          
          console.log('Successfully Fetched: ' + streamUrl);

          resolve([{
            url: streamUrl,
            quality: 'HD',
            format: streamUrl.includes('m3u8') ? 'm3u8' : 'mp4',
            headers: {
              'User-Agent': HEADERS['User-Agent'],
              'Referer': 'https://einthusan.tv/',
              'Origin': 'https://einthusan.tv',
              'Accept-Encoding': 'identity;q=1, *;q=0'
            }
          }]);
        } else {
          // If no link found, let's see if we are getting blocked
          if (html.includes('Cloudflare') || html.length < 1000) {
              console.log('FETCH FAILED: Page blocked or empty.');
          } else {
              console.log('FETCH FAILED: Page loaded but regex missed the link.');
          }
          resolve([]);
        }
      })
      .catch(function (err) {
        console.log('CRITICAL ERROR: ' + err);
        resolve([]);
      });
  });
}

module.exports = { getStreams: getStreams };
