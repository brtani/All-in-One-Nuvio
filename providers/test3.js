// ShowBox Scraper for Nuvio Local Scrapers
// React Native compatible version - Promise-based approach only

// TMDB API Configuration
var TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
var TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// ShowBox API Configuration
var SHOWBOX_API_BASE = 'https://febapi.nuvioapp.space/api/media';

// Working headers for ShowBox API
var WORKING_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G981B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'Content-Type': 'application/json'
};

// UI token (cookie) is provided by the host app via per-scraper settings (Plugin Screen)
function getUiToken() {
    try {
        var settings = (typeof global !== 'undefined' && global.SCRAPER_SETTINGS) ? global.SCRAPER_SETTINGS : 
                       (typeof window !== 'undefined' && window.SCRAPER_SETTINGS) ? window.SCRAPER_SETTINGS : {};
        if (settings.uiToken) {
            return String(settings.uiToken);
        }
    } catch (e) {
        // ignore
    }
    return '';
}

function getOssGroup() {
    try {
        var settings = (typeof global !== 'undefined' && global.SCRAPER_SETTINGS) ? global.SCRAPER_SETTINGS : 
                       (typeof window !== 'undefined' && window.SCRAPER_SETTINGS) ? window.SCRAPER_SETTINGS : {};
        if (settings.ossGroup) {
            return String(settings.ossGroup);
        }
    } catch (e) {
        // ignore
    }
    return null;
}

// Utility Functions
function getQualityFromName(qualityStr) {
    if (!qualityStr) return 'Unknown';
    var quality = qualityStr.toUpperCase();
    if (quality === 'ORG' || quality === 'ORIGINAL') return 'Original';
    if (quality === '4K' || quality === '2160P') return '4K';
    if (quality === '1080P' || quality === 'FHD') return '1080p';
    if (quality === '720P' || quality === 'HD') return '720p';
    if (quality === '480P' || quality === 'SD') return '480p';
    return qualityStr;
}

function formatFileSize(sizeStr) {
    if (!sizeStr) return 'Unknown';
    if (typeof sizeStr === 'string' && (sizeStr.indexOf('GB') !== -1 || sizeStr.indexOf('MB') !== -1)) {
        return sizeStr;
    }
    if (typeof sizeStr === 'number') {
        var gb = sizeStr / (1024 * 1024 * 1024);
        if (gb >= 1) return gb.toFixed(2) + ' GB';
        return (sizeStr / (1024 * 1024)).toFixed(2) + ' MB';
    }
    return sizeStr;
}

function makeRequest(url, options) {
    var opts = options || {};
    return fetch(url, {
        method: opts.method || 'GET',
        headers: WORKING_HEADERS
    }).then(function(response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response;
    });
}

function getTMDBDetails(tmdbId, mediaType) {
    var endpoint = (mediaType === 'tv') ? 'tv' : 'movie';
    var url = TMDB_BASE_URL + '/' + endpoint + '/' + tmdbId + '?api_key=' + TMDB_API_KEY;
    
    return makeRequest(url)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            return {
                title: (mediaType === 'tv') ? data.name : data.title,
                year: (mediaType === 'tv' ? data.first_air_date : data.release_date || "").split('-')[0]
            };
        })
        .catch(function() {
            return { title: "Media", year: null };
        });
}

function processShowBoxResponse(data, mediaInfo, mediaType, seasonNum, episodeNum) {
    var streams = [];
    if (!data || !data.versions) return streams;

    var streamTitle = mediaInfo.title || 'Unknown';
    if (mediaType === 'tv') {
        streamTitle += ' S' + seasonNum + 'E' + episodeNum;
    }

    for (var i = 0; i < data.versions.length; i++) {
        var version = data.versions[i];
        if (version.links) {
            for (var j = 0; j < version.links.length; j++) {
                var link = version.links[j];
                var quality = getQualityFromName(link.quality || 'Unknown');
                streams.push({
                    name: 'ShowBox ' + quality,
                    title: streamTitle,
                    url: link.url,
                    quality: quality,
                    size: formatFileSize(link.size || version.size),
                    provider: 'showbox'
                });
            }
        }
    }
    return streams;
}

function getStreams(tmdbId, mediaType, seasonNum, episodeNum) {
    var cookie = getUiToken();
    if (!cookie) return Promise.resolve([]);

    return getTMDBDetails(tmdbId, mediaType).then(function(mediaInfo) {
        var ossGroup = getOssGroup();
        var apiUrl;
        if (mediaType === 'tv') {
            apiUrl = SHOWBOX_API_BASE + '/tv/' + tmdbId + (ossGroup ? '/oss=' + ossGroup : '') + '/' + seasonNum + '/' + episodeNum + '?cookie=' + encodeURIComponent(cookie);
        } else {
            apiUrl = SHOWBOX_API_BASE + '/movie/' + tmdbId + '?cookie=' + encodeURIComponent(cookie);
        }

        return makeRequest(apiUrl)
            .then(function(response) { return response.json(); })
            .then(function(data) {
                return processShowBoxResponse(data, mediaInfo, mediaType, seasonNum, episodeNum);
            })
            .catch(function() { return []; });
    });
}

// Export for all environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams: getStreams };
}
if (typeof global !== 'undefined') {
    global.getStreams = getStreams;
    global.ShowBoxScraperModule = { getStreams: getStreams };
}
if (typeof window !== 'undefined') {
    window.getStreams = getStreams;
}
