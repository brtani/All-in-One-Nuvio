// Domty Multi‑Source Provider for Nuvio
// Compatible with NetMirror-style loaders

console.log('[Domty] Initializing provider');

// ── Shared ───────────────────────────────────────────────────────────────────
var DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ar,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

function httpGet(url, extraHeaders) {
  var headers = Object.assign({}, DEFAULT_HEADERS, extraHeaders || {});
  return fetch(url, { headers: headers }).then(function(res) {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.text();
  });
}

function extractDirectSources(html) {
  var sources = [];
  var patterns = [
    /["'](https?:\/\/[^"']+\.m3u8[^"']*?)["']/g,
    /["'](https?:\/\/[^"']+\.mp4[^"']*?)["']/g,
    /file:\s*["'](https?:\/\/[^"']+)["']/g,
    /src:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*?)["']/g,
  ];

  patterns.forEach(function(re) {
    var m;
    while ((m = re.exec(html)) !== null) {
      if (sources.indexOf(m[1]) === -1) sources.push(m[1]);
    }
  });

  return sources;
}

function extractIframes(html) {
  var iframes = [];
  var re = /<iframe[^>]+(?:src|data-src)=["']([^"']+)["']/gi;
  var m;

  while ((m = re.exec(html)) !== null) {
    if (m[1].indexOf('http') === 0) iframes.push(m[1]);
  }

  return iframes;
}

function normalizeQuality(str) {
  if (!str) return 'HD';
  if (/4k|2160/i.test(str)) return '4K';
  if (/1080/i.test(str)) return '1080p';
  if (/720/i.test(str)) return '720p';
  if (/480/i.test(str)) return '480p';
  return 'HD';
}

function makeStream(name, url, quality, referer) {
  var s = { name: name, title: quality, url: url, quality: quality };

  if (referer) {
    s.headers = {
      'Referer': referer,
      'User-Agent': DEFAULT_HEADERS['User-Agent']
    };
  }

  return s;
}

function fetchStreamsFromPage(name, pageUrl, base) {
  return httpGet(pageUrl, { Referer: base }).then(function(html) {

    var streams = [];

    extractDirectSources(html).forEach(function(u) {
      streams.push(makeStream(name, u, normalizeQuality(u), pageUrl));
    });

    if (streams.length) return streams;

    var iframes = extractIframes(html);

    return Promise.all(
      iframes.slice(0, 3).map(function(src) {
        return httpGet(src, { Referer: pageUrl })
          .then(function(ih) {

            return extractDirectSources(ih).map(function(u) {
              return makeStream(name, u, normalizeQuality(u), src);
            });

          }).catch(function() {
            return [];
          });
      })
    ).then(function(r) {
      return r.reduce(function(a, b) {
        return a.concat(b);
      }, streams);
    });

  });
}

function searchSite(name, base, query, mediaType) {

  var url = base + '/?s=' + encodeURIComponent(query);

  return httpGet(url, { Referer: base })
    .then(function(html) {

      var items = [];
      var re = /<article[^>]*>([\s\S]*?)<\/article>/gi;
      var m;

      while ((m = re.exec(html)) !== null) {

        var block = m[1];

        var titleM = block.match(/<h[23][^>]*>([^<]+)<\/h[23]>/i);
        var linkM = block.match(/href=["'](https?:\/\/[^"']+)["']/i);

        if (titleM && linkM) {

          items.push({
            name: name,
            base: base,
            title: titleM[1].trim(),
            url: linkM[1],
            isMovie: /film|movie/.test(linkM[1])
          });

        }
      }

      return items;

    }).catch(function() {
      return [];
    });
}

// ── Sources ───────────────────────────────────────────────────────────────────
var SOURCES = [
  { id: 'cimawbas', base: 'https://cimawbas.org' },
  { id: 'egybest', base: 'https://egybest.la' },
  { id: 'mycima', base: 'https://mycima.horse' },
  { id: 'flowind', base: 'https://flowind.net' },
  { id: 'aksv', base: 'https://ak.sv' },
  { id: 'fajer', base: 'https://fajer.show' },
  { id: 'x7k9f', base: 'https://x7k9f.sbs' },
  { id: 'asd', base: 'https://asd.pics' },
  { id: 'laroza', base: 'https://q.larozavideo.net' },
  { id: 'animezid', base: 'https://eg.animezid.cc' },
  { id: 'arabic-toons', base: 'https://arabic-toons.com' },
];

// ── Main ─────────────────────────────────────────────────────────────────────
function getStreams(tmdbId, mediaType, season, episode) {

  console.log('[Domty] getStreams:', tmdbId, mediaType);

  var query = mediaType === 'tv'
    ? tmdbId + ' s' + (season || 1) + 'e' + (episode || 1)
    : tmdbId;

  var promises = SOURCES.map(function(source) {

    return searchSite(source.id, source.base, query, mediaType)

      .then(function(results) {

        if (!results.length) return [];

        var match = results[0];

        for (var i = 0; i < results.length; i++) {

          if (mediaType === 'movie' && results[i].isMovie) {
            match = results[i];
            break;
          }

          if (mediaType !== 'movie' && !results[i].isMovie) {
            match = results[i];
            break;
          }

        }

        return fetchStreamsFromPage(source.id, match.url, source.base);

      })

      .catch(function() {
        return [];
      });

  });

  return Promise.all(promises).then(function(results) {

    var all = results.reduce(function(a, b) {
      return a.concat(b);
    }, []);

    var seen = {};

    return all.filter(function(s) {

      if (seen[s.url]) return false;

      seen[s.url] = true;
      return true;

    });

  });
   }
