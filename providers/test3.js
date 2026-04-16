// ============================================================
// Einthusan Debug Provider
// ============================================================

var BASE_URL = 'https://einthusan.tv';

var HEADERS = {
  'sec-ch-ua': '"Chromium";v="146", "Not-A.Brand";v="24", "Android WebView";v="146"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 15; ALT-NX1 Build/HONORALT-N31; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/146.0.7680.177 Mobile Safari/537.36',
  'Accept': '*/*',
  'Referer': 'https://einthusan.tv/',
  'X-Requested-With': 'XMLHttpRequest'
};

function getStreams(tmdbId, mediaType) {
  return new Promise(function (resolve) {
    // For testing, let's use a direct link logic first to see if we can even reach the page
    // Target: https://einthusan.tv/movie/watch/21lw/?lang=hindi
    var testUrl = BASE_URL + '/movie/watch/21lw/?lang=hindi';
    
    console.log('--- Starting Request to: ' + testUrl + ' ---');

    fetch(testUrl, { headers: HEADERS })
      .then(function (res) {
        console.log('Response Status:', res.status);
        return res.text();
      })
      .then(function (html) {
        // Log a small piece of the HTML to see if it's a real page or an error/captcha
        console.log('HTML Preview:', html.substring(0, 500).replace(/\s+/g, ' '));

        if (html.includes('Cloudflare') || html.includes('captcha')) {
          console.log('Result: Blocked by security challenge 🛡️');
          return resolve([]);
        }

        // Try to find the m3u8 or mp4 link
        var streamPattern = /["'](https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)["']/i;
        var match = html.match(streamPattern);

        if (match) {
          console.log('Result: Found link! ✅');
          resolve([{
            url: match[1],
            quality: 'HD',
            format: match[1].includes('m3u8') ? 'm3u8' : 'mp4'
          }]);
        } else {
          console.log('Result: Page loaded but no video link found 🔍');
          resolve([]);
        }
      })
      .catch(function (err) {
        console.log('Fetch Error:', err.message);
        resolve([]);
      });
  });
}

module.exports = { getStreams: getStreams };
