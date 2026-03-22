/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║                       HindMoviez — Nuvio Stream Plugin                       ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Source     › https://hindmovie.ltd                                          ║
 * ║  Author     › Sanchit  |  TG: @S4NCHITT                                      ║
 * ║  Project    › Murph's Streams                                                ║
 * ║  Manifest   › https://badboysxs-morpheus.hf.space/manifest.json              ║
 * ╠══════════════════════════════════════════════════════════════════════════════╣
 * ║  Supports   › Movies & Series  (480p / 720p / 1080p / 4K)                    ║
 * ║  Chain      › mvlink.site → hshare.ink → hcloud → Servers                    ║
 * ║  MKV Probe  › HTTP Range sniff → EBML parse → height + audio lang            ║
 * ║  Parallel   › All quality & episode links resolved concurrently              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

const cheerio = require('cheerio-without-node-native');

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL     = 'https://hindmovie.ltd';
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const PLUGIN_TAG   = '[HindMoviez]';

// How many bytes to pull from the MKV header for probing.
// 512 KB is enough to cover EBML head + Segment Info + all Tracks in most files.
const MKV_PROBE_BYTES = 524288;

const DEFAULT_HEADERS = {
  'User-Agent'      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept'          : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language' : 'en-US,en;q=0.9',
};

// ─────────────────────────────────────────────────────────────────────────────
// HTTP Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a URL and return its response body as text.
 * Returns null on any network or HTTP error.
 */
function fetchText(url, extraHeaders) {
  return fetch(url, {
    headers  : Object.assign({}, DEFAULT_HEADERS, extraHeaders || {}),
    redirect : 'follow',
  })
    .then(function (res) { return res.text(); })
    .catch(function (err) {
      console.log(PLUGIN_TAG + ' Fetch failed [' + url + ']: ' + err.message);
      return null;
    });
}

/**
 * Fetch a URL following all redirects, returning both the final HTML
 * and the resolved URL after any redirect chain.
 */
function fetchTextWithFinalUrl(url, extraHeaders) {
  return fetch(url, {
    headers  : Object.assign({}, DEFAULT_HEADERS, extraHeaders || {}),
    redirect : 'follow',
  })
    .then(function (res) {
      return res.text().then(function (text) {
        return { html: text, finalUrl: res.url };
      });
    })
    .catch(function (err) {
      console.log(PLUGIN_TAG + ' Fetch+redirect failed [' + url + ']: ' + err.message);
      return { html: null, finalUrl: url };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// MKV Header Prober
// Fetches only the first MKV_PROBE_BYTES via HTTP Range request, then parses
// the raw EBML binary to extract:
//   • Video pixel height  → mapped to a quality label (480p / 720p / 1080p / 4K)
//   • Audio track languages (BCP-47 / ISO 639 codes stored in the Tracks element)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * EBML Element IDs we care about (Matroska spec).
 * All values are big-endian hex as they appear in the binary stream.
 */
var EBML_IDS = {
  Tracks          : 0x1654AE6B,
  TrackEntry      : 0xAE,
  TrackType       : 0x83,   // 1 = video, 2 = audio
  Language        : 0x22B59C,
  LanguageBCP47   : 0x22B59D,
  Video           : 0xE0,
  PixelHeight     : 0xBA,
};

/**
 * Read a variable-length EBML integer from a DataView at the given offset.
 * Returns { value, bytesRead } or null on error.
 */
function readVint(view, offset) {
  if (offset >= view.byteLength) return null;
  var firstByte = view.getUint8(offset);
  if (firstByte === 0) return null;

  // Determine width from leading-zero count
  var width = 1;
  var mask = 0x80;
  while (!(firstByte & mask) && width <= 8) {
    width++;
    mask >>= 1;
  }
  if (offset + width > view.byteLength) return null;

  // Read the value, stripping the length marker bit
  var value = firstByte & (mask - 1);
  for (var i = 1; i < width; i++) {
    value = (value * 256) + view.getUint8(offset + i);
  }
  return { value: value, bytesRead: width };
}

/**
 * Read an EBML element ID (which is itself a vint but we keep the marker bit).
 * Returns { id, bytesRead } or null.
 */
function readElementId(view, offset) {
  if (offset >= view.byteLength) return null;
  var firstByte = view.getUint8(offset);
  var width = 1;
  var mask = 0x80;
  while (!(firstByte & mask) && width <= 4) {
    width++;
    mask >>= 1;
  }
  if (offset + width > view.byteLength) return null;

  var id = 0;
  for (var i = 0; i < width; i++) {
    id = (id * 256) + view.getUint8(offset + i);
  }
  return { id: id, bytesRead: width };
}

/**
 * Read a UTF-8 string from a DataView slice.
 */
function readString(view, offset, length) {
  var bytes = [];
  for (var i = 0; i < length && offset + i < view.byteLength; i++) {
    var b = view.getUint8(offset + i);
    if (b === 0) break; // null-terminated
    bytes.push(b);
  }
  return bytes.map(function (b) { return String.fromCharCode(b); }).join('');
}

/**
 * Read an unsigned integer from a DataView slice (big-endian).
 */
function readUint(view, offset, length) {
  var val = 0;
  for (var i = 0; i < length && offset + i < view.byteLength; i++) {
    val = (val * 256) + view.getUint8(offset + i);
  }
  return val;
}

/**
 * Scan an EBML data region and collect all TrackEntry blocks,
 * returning an array of { type, language, pixelHeight } objects.
 *
 * This is a shallow recursive parser — it only descends into elements
 * we care about (Tracks, TrackEntry, Video) to stay fast.
 */
function parseEbmlTracks(view, start, end) {
  var tracks = [];
  var offset = start;

  while (offset < end) {
    var idResult = readElementId(view, offset);
    if (!idResult) break;
    offset += idResult.bytesRead;

    var sizeResult = readVint(view, offset);
    if (!sizeResult) break;
    offset += sizeResult.bytesRead;

    var dataOffset = offset;
    var dataSize   = sizeResult.value;

    // Guard against corrupt/huge sizes
    if (dataSize > 0x4000000 || dataOffset + dataSize > view.byteLength + 1024) {
      break;
    }

    var id = idResult.id;

    if (id === EBML_IDS.Tracks) {
      // Recurse into Tracks container
      tracks = tracks.concat(parseEbmlTracks(view, dataOffset, Math.min(dataOffset + dataSize, view.byteLength)));

    } else if (id === EBML_IDS.TrackEntry) {
      // Parse a single track entry
      var track = parseTrackEntry(view, dataOffset, Math.min(dataOffset + dataSize, view.byteLength));
      if (track) tracks.push(track);

    }

    offset = dataOffset + dataSize;
    if (offset <= dataOffset) break; // prevent infinite loop on zero-size
  }

  return tracks;
}

/**
 * Parse a single TrackEntry element, extracting type / language / pixelHeight.
 */
function parseTrackEntry(view, start, end) {
  var track = { type: 0, language: null, pixelHeight: 0 };
  var offset = start;

  while (offset < end) {
    var idResult = readElementId(view, offset);
    if (!idResult) break;
    offset += idResult.bytesRead;

    var sizeResult = readVint(view, offset);
    if (!sizeResult) break;
    offset += sizeResult.bytesRead;

    var dataOffset = offset;
    var dataSize   = sizeResult.value;
    if (dataSize > 0x1000000) break;

    var id = idResult.id;

    if (id === EBML_IDS.TrackType) {
      track.type = readUint(view, dataOffset, dataSize);

    } else if (id === EBML_IDS.Language || id === EBML_IDS.LanguageBCP47) {
      track.language = readString(view, dataOffset, dataSize).trim() || null;

    } else if (id === EBML_IDS.Video) {
      // Recurse into the Video sub-element to get PixelHeight
      track.pixelHeight = parseVideoHeight(view, dataOffset, Math.min(dataOffset + dataSize, view.byteLength));

    }

    offset = dataOffset + dataSize;
    if (offset <= dataOffset) break;
  }

  return track;
}

/**
 * Scan a Video element for the PixelHeight field.
 */
function parseVideoHeight(view, start, end) {
  var offset = start;
  while (offset < end) {
    var idResult = readElementId(view, offset);
    if (!idResult) break;
    offset += idResult.bytesRead;

    var sizeResult = readVint(view, offset);
    if (!sizeResult) break;
    offset += sizeResult.bytesRead;

    if (idResult.id === EBML_IDS.PixelHeight) {
      return readUint(view, offset, sizeResult.value);
    }

    offset += sizeResult.value;
    if (offset <= 0) break;
  }
  return 0;
}

/**
 * Map a raw pixel height to a clean quality label.
 */
function heightToQualityLabel(h) {
  if (h >= 2000) return '4K (2160p)';
  if (h >= 1060) return '1080p';
  if (h >= 700)  return '720p';
  if (h >= 440)  return '480p';
  if (h > 0)     return h + 'p';
  return null;
}

/**
 * Map an ISO 639-2/BCP-47 language code to a human-readable label.
 */
var LANG_NAMES = {
  'eng': 'English', 'en': 'English',
  'hin': 'Hindi',   'hi': 'Hindi',
  'tam': 'Tamil',   'ta': 'Tamil',
  'tel': 'Telugu',  'te': 'Telugu',
  'mal': 'Malayalam','ml': 'Malayalam',
  'kan': 'Kannada', 'kn': 'Kannada',
  'ben': 'Bengali',  'bn': 'Bengali',
  'pun': 'Punjabi',  'pa': 'Punjabi',
  'mar': 'Marathi',  'mr': 'Marathi',
  'urd': 'Urdu',     'ur': 'Urdu',
  'jpn': 'Japanese', 'ja': 'Japanese',
  'kor': 'Korean',   'ko': 'Korean',
  'chi': 'Chinese',  'zh': 'Chinese',
  'zho': 'Chinese',
  'spa': 'Spanish',  'es': 'Spanish',
  'fre': 'French',   'fr': 'French',
  'ger': 'German',   'de': 'German',
  'ara': 'Arabic',   'ar': 'Arabic',
  'und': null, // undefined — skip
};

function langCodeToName(code) {
  if (!code) return null;
  var lower = code.toLowerCase().split('-')[0]; // handle BCP-47 like "hi-IN"
  return LANG_NAMES[lower] || code.toUpperCase();
}

/**
 * Probe a remote MKV/MP4 file by fetching only the first MKV_PROBE_BYTES bytes
 * via an HTTP Range request, then parsing the EBML binary structure.
 *
 * Returns a Promise resolving to:
 *   { qualityLabel: string|null, audioLanguages: string[] }
 *
 * Silently returns empty info on any failure so streams still appear.
 */
function probeMkvInfo(url) {
  console.log(PLUGIN_TAG + ' MKV probe → ' + url);

  return fetch(url, {
    method  : 'GET',
    headers : Object.assign({}, DEFAULT_HEADERS, {
      'Range' : 'bytes=0-' + (MKV_PROBE_BYTES - 1),
    }),
    redirect: 'follow',
  })
    .then(function (res) {
      // Accept 206 Partial Content or 200 (server ignoring Range)
      if (res.status !== 206 && res.status !== 200) {
        console.log(PLUGIN_TAG + ' MKV probe got HTTP ' + res.status + ' — skipping');
        return { qualityLabel: null, audioLanguages: [] };
      }
      return res.arrayBuffer().then(function (buf) {
        return parseMkvBuffer(buf);
      });
    })
    .catch(function (err) {
      console.log(PLUGIN_TAG + ' MKV probe failed: ' + err.message);
      return { qualityLabel: null, audioLanguages: [] };
    });
}

/**
 * Parse an ArrayBuffer (raw MKV/EBML bytes) and return
 * { qualityLabel, audioLanguages }.
 */
function parseMkvBuffer(buf) {
  var view = new DataView(buf);

  // Quick sanity check: MKV files start with EBML magic 0x1A 0x45 0xDF 0xA3
  if (view.byteLength < 4) return { qualityLabel: null, audioLanguages: [] };
  var magic = view.getUint32(0);
  if (magic !== 0x1A45DFA3) {
    console.log(PLUGIN_TAG + ' Not an MKV/EBML file (magic: 0x' + magic.toString(16) + ')');
    return { qualityLabel: null, audioLanguages: [] };
  }

  // Parse from byte 0 across the full probe window
  var tracks = parseEbmlTracks(view, 0, view.byteLength);
  console.log(PLUGIN_TAG + ' EBML parsed — ' + tracks.length + ' track(s) found');

  // ── Derive quality from video track pixel height ──────────────────────────
  var qualityLabel = null;
  var videoTrack = tracks.find(function (t) { return t.type === 1 && t.pixelHeight > 0; });
  if (videoTrack) {
    qualityLabel = heightToQualityLabel(videoTrack.pixelHeight);
    console.log(PLUGIN_TAG + ' Video height: ' + videoTrack.pixelHeight + 'px → ' + qualityLabel);
  }

  // ── Collect unique audio language names ───────────────────────────────────
  var seen = {};
  var audioLanguages = [];
  tracks
    .filter(function (t) { return t.type === 2; })
    .forEach(function (t) {
      var name = langCodeToName(t.language);
      if (name && !seen[name]) {
        seen[name] = true;
        audioLanguages.push(name);
      }
    });

  if (audioLanguages.length) {
    console.log(PLUGIN_TAG + ' Audio tracks: ' + audioLanguages.join(', '));
  }

  return { qualityLabel: qualityLabel, audioLanguages: audioLanguages };
}

// ─────────────────────────────────────────────────────────────────────────────
// TMDB — Title & Year Lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a TMDB ID to a { title, year } object.
 * Handles both movie and TV/series types.
 */
function getTmdbDetails(tmdbId, type) {
  var isSeries = (type === 'series' || type === 'tv');
  var endpoint = isSeries ? 'tv' : 'movie';
  var url = 'https://api.themoviedb.org/3/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;

  console.log(PLUGIN_TAG + ' TMDB lookup → ' + url);

  return fetch(url)
    .then(function (res) { return res.json(); })
    .then(function (data) {
      if (isSeries) {
        return {
          title : data.name,
          year  : data.first_air_date ? parseInt(data.first_air_date.split('-')[0]) : 0,
        };
      }
      return {
        title : data.title,
        year  : data.release_date ? parseInt(data.release_date.split('-')[0]) : 0,
      };
    })
    .catch(function (err) {
      console.log(PLUGIN_TAG + ' TMDB request failed: ' + err.message);
      return null;
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract article cards (title + URL) from a HindMoviez search results page.
 */
function parseArticles(html) {
  var $ = cheerio.load(html);
  var results = [];

  $('article').each(function (_i, el) {
    var titleTag = $(el).find('h2.entry-title, a[rel="bookmark"]').first();
    if (!titleTag.length) return;

    var title = titleTag.text().trim();
    var a     = titleTag.is('a') ? titleTag : titleTag.find('a').first();
    var link  = a.attr('href');

    if (link) results.push({ title: title, link: link });
  });

  return results;
}

/**
 * Extract quality-labelled download buttons (mvlink.site links)
 * from a movie or series detail page.
 */
function parseDownloadButtons(html) {
  var $ = cheerio.load(html);
  var links = [];

  $('a[href*="mvlink.site"]').each(function (_i, el) {
    var href = $(el).attr('href');
    var text = $(el).text().trim();
    var ctx  = text;

    // Widen context to parent + previous sibling for quality detection
    var parent = $(el).parent();
    if (parent.length) {
      ctx += ' ' + parent.text();
      var prev = parent.prev();
      if (prev.length) ctx += ' ' + prev.text();
    }

    var match   = ctx.match(/(480p|720p|1080p|2160p|4K)/i);
    var quality = match ? match[1] : 'Unknown';

    links.push({ quality: quality, link: href, text: text });
  });

  return links;
}

/**
 * Extract individual episode links (or a single movie link) from an mvlink page.
 */
function parseEpisodes(html) {
  var $ = cheerio.load(html);
  var episodes = [];

  $('a').each(function (_i, el) {
    var text = $(el).text().trim();
    if (/Episode\s*\d+/i.test(text)) {
      episodes.push({ title: text, link: $(el).attr('href') });
    }
  });

  // Fallback for movies — look for a "Get Links" button
  if (!episodes.length) {
    var getLinks = $('a').filter(function (_i, el) {
      return /Get Links/i.test($(el).text());
    }).first();

    if (getLinks.length) {
      episodes.push({ title: 'Movie Link', link: getLinks.attr('href') });
    }
  }

  return episodes;
}

/**
 * Locate the hshare.ink redirect URL from an mvlink page or its final URL.
 */
function parseHshareUrl(html, finalUrl) {
  if (finalUrl && finalUrl.indexOf('hshare.ink') !== -1) return finalUrl;

  var $ = cheerio.load(html);

  var btn = $('a').filter(function (_i, el) {
    return /Get Links/i.test($(el).text());
  }).first();

  if (btn.length) {
    var href = btn.attr('href') || '';
    if (href.indexOf('hshare.ink') !== -1) return href;
  }

  var fallback = $('a[href*="hshare.ink"]').first().attr('href');
  return fallback || null;
}

/**
 * Extract the hcloud "HPage" link from an hshare page.
 */
function parseHcloudUrl(html) {
  var $ = cheerio.load(html);
  var btn = $('a').filter(function (_i, el) {
    return /HPage/i.test($(el).text());
  }).first();
  return btn.length ? btn.attr('href') : null;
}

/**
 * Extract numbered server download links from the final hcloud page.
 * Tries #download-btn{N} IDs first, then falls back to link text matching.
 */
function parseServers(html) {
  var $ = cheerio.load(html);
  var servers = {};

  for (var i = 1; i <= 5; i++) {
    var btn = $('#download-btn' + i);
    if (btn.length && btn.attr('href')) {
      servers['Server ' + i] = btn.attr('href');
    }
  }

  if (!Object.keys(servers).length) {
    $('a').each(function (_i, el) {
      var text = $(el).text().trim();
      if (/Server\s*\d+/i.test(text)) {
        servers[text] = $(el).attr('href');
      }
    });
  }

  return servers;
}

// ─────────────────────────────────────────────────────────────────────────────
// Redirect Chain Resolver
// mvlink.site → hshare.ink → hcloud → { Server 1, Server 2, … }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Walk the full 4-step redirect chain and return a map of
 * server names → final download URLs.
 * Returns an empty object if any step in the chain fails.
 */
function resolveServerChain(mvlinkUrl) {
  return fetchTextWithFinalUrl(mvlinkUrl).then(function (result) {
    if (!result.html) return {};

    var hshareUrl = parseHshareUrl(result.html, result.finalUrl);
    if (!hshareUrl) {
      console.log(PLUGIN_TAG + ' hshare URL not found for: ' + mvlinkUrl);
      return {};
    }

    return fetchText(hshareUrl).then(function (hshareHtml) {
      if (!hshareHtml) return {};

      var hcloudUrl = parseHcloudUrl(hshareHtml);
      if (!hcloudUrl) {
        console.log(PLUGIN_TAG + ' hcloud URL not found for: ' + hshareUrl);
        return {};
      }

      return fetchText(hcloudUrl).then(function (hcloudHtml) {
        if (!hcloudHtml) return {};
        return parseServers(hcloudHtml);
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Site Search
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search HindMoviez for the given title and return the URL of the best-matching page.
 */
function findPageUrl(title) {
  var searchUrl = BASE_URL + '/?s=' + encodeURIComponent(title);

  return fetchText(searchUrl).then(function (html) {
    if (!html) return null;

    var articles = parseArticles(html);
    if (!articles.length) return null;

    console.log(PLUGIN_TAG + ' Search hit → "' + articles[0].title + '"');
    return articles[0].link;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

/** Convert a quality string (e.g. "1080p", "4K") to a pixel-height integer. */
function qualityToHeight(quality) {
  if (!quality) return 0;
  var q = quality.toLowerCase();
  if (q === '4k' || q === '2160p') return 2160;
  if (q === '1080p')               return 1080;
  if (q === '720p')                return 720;
  if (q === '480p')                return 480;
  return 0;
}

/**
 * Check if a URL likely points to an MKV file.
 * We probe MKV files only — MP4/m3u8 use a different container format.
 */
function isMkvUrl(url) {
  if (!url) return false;
  var lower = url.toLowerCase().split('?')[0]; // strip query params
  return lower.endsWith('.mkv');
}

// ─────────────────────────────────────────────────────────────────────────────
// Stream Builder — assembles the final stream object with MKV info baked in
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a Nuvio stream object for one server URL.
 * If the URL is an MKV, probes its header to enrich quality + audio labels.
 * Falls back gracefully if probing fails.
 *
 * @param {string} url          - Final download/stream URL
 * @param {string} serverName   - e.g. "Server 1"
 * @param {string} epTitle      - Episode or movie title string
 * @param {string} scraperQuality - Quality hint from the scraper (e.g. "1080p")
 * @returns {Promise<Object>}     Nuvio stream object
 */
function buildStream(url, serverName, epTitle, scraperQuality) {
  var scraperHeight = qualityToHeight(scraperQuality);

  // Only probe MKV files — other formats skip straight to building
  var probePromise = isMkvUrl(url)
    ? probeMkvInfo(url)
    : Promise.resolve({ qualityLabel: null, audioLanguages: [] });

  return probePromise.then(function (info) {
    // ── Quality label ────────────────────────────────────────────────────────
    // Prefer MKV-probed label (exact), fall back to scraper hint
    var qualityLabel = info.qualityLabel
      || (scraperHeight ? scraperHeight + 'p' : scraperQuality || 'Unknown');

    // ── Audio languages ──────────────────────────────────────────────────────
    var audioStr = info.audioLanguages.length
      ? info.audioLanguages.join(' + ')
      : null;

    // ── Stream name shown in Nuvio UI ────────────────────────────────────────
    var nameParts = ['🎬 HindMoviez', serverName, qualityLabel];
    if (audioStr) nameParts.push('🔊 ' + audioStr);
    var streamName = nameParts.join(' | ');

    // ── Title subtitle (shown below stream name) ─────────────────────────────
    var titleLines = [epTitle];
    if (qualityLabel) titleLines.push('📺 ' + qualityLabel);
    if (audioStr)     titleLines.push('🔊 ' + audioStr);
    titleLines.push('by Sanchit · @S4NCHITT · Murph\'s Streams');
    var streamTitle = titleLines.join('\n');

    return {
      name  : streamName,
      title : streamTitle,
      url   : url,
      quality: qualityLabel,
      behaviorHints: {
        bingeGroup : 'hindmoviez-' + serverName.replace(/\s+/g, '-').toLowerCase(),
      },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API — getStreams
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main entry point called by the Nuvio plugin runner.
 *
 * @param {string}        tmdbId   - TMDB content ID
 * @param {string}        type     - "movie" | "series" | "tv"
 * @param {number|string} season   - Season number  (series only)
 * @param {number|string} episode  - Episode number (series only)
 * @returns {Promise<Array>}         Array of Nuvio-compatible stream objects
 */
function getStreams(tmdbId, type, season, episode) {
  return getTmdbDetails(tmdbId, type).then(function (details) {
    if (!details) {
      console.log(PLUGIN_TAG + ' TMDB lookup returned nothing — aborting.');
      return [];
    }

    var isSeries = (type === 'series' || type === 'tv');
    var label    = details.title + (isSeries ? ' S' + season + 'E' + episode : '');
    console.log(PLUGIN_TAG + ' ► Searching for: ' + label);

    return findPageUrl(details.title).then(function (pageUrl) {
      if (!pageUrl) {
        console.log(PLUGIN_TAG + ' Page not found for: ' + details.title);
        return [];
      }
      console.log(PLUGIN_TAG + ' Page → ' + pageUrl);

      return fetchText(pageUrl).then(function (pageHtml) {
        if (!pageHtml) return [];

        var qualityButtons = parseDownloadButtons(pageHtml);
        if (!qualityButtons.length) {
          console.log(PLUGIN_TAG + ' No download buttons on page.');
          return [];
        }
        console.log(PLUGIN_TAG + ' ' + qualityButtons.length + ' quality option(s) found.');

        // ── Fetch all mvlink pages in parallel ──────────────────────────────
        var mvPromises = qualityButtons.map(function (qb) {
          return fetchTextWithFinalUrl(qb.link).then(function (result) {
            return { html: result.html, finalUrl: result.finalUrl, quality: qb.quality };
          });
        });

        return Promise.all(mvPromises).then(function (mvResults) {

          // ── Collect episodes / links to resolve ────────────────────────────
          var toResolve = [];

          mvResults.forEach(function (mv) {
            if (!mv.html) return;
            var episodes = parseEpisodes(mv.html);

            episodes.forEach(function (ep) {
              if (isSeries && season && episode) {
                var epStr = 'Episode ' + String(episode).padStart(2, '0');
                if (ep.title.indexOf(epStr) === -1) return;
              }
              toResolve.push({ ep: ep, quality: mv.quality });
            });
          });

          if (!toResolve.length) {
            console.log(PLUGIN_TAG + ' No matching links to resolve.');
            return [];
          }
          console.log(PLUGIN_TAG + ' Resolving ' + toResolve.length + ' link(s) in parallel…');

          // ── Resolve all server chains in parallel ──────────────────────────
          var resolvePromises = toResolve.map(function (item) {
            return resolveServerChain(item.ep.link).then(function (servers) {
              return { ep: item.ep, quality: item.quality, servers: servers };
            });
          });

          return Promise.all(resolvePromises).then(function (resolved) {

            // ── Build stream objects (with MKV probing) in parallel ──────────
            var streamPromises = [];

            resolved.forEach(function (res) {
              Object.keys(res.servers).forEach(function (serverName) {
                var url = res.servers[serverName];
                if (!url) return;

                streamPromises.push(
                  buildStream(url, serverName, res.ep.title, res.quality)
                );
              });
            });

            return Promise.all(streamPromises).then(function (streams) {
              console.log(PLUGIN_TAG + ' Done — ' + streams.length + ' stream(s) ready.');
              return streams;
            });
          });
        });
      });
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Export
// ─────────────────────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getStreams };
} else {
  global.getStreams = getStreams;
}
