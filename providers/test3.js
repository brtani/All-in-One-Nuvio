/**
 * @name ShowBox Scraper
 * @description ShowBox API scraper for Nuvio
 * @settings
 * [
 * {"name": "uiToken", "type": "text", "label": "UI Token (Cookie)", "placeholder": "Paste token here..."},
 * {"name": "ossGroup", "type": "text", "label": "OSS Group (Optional)", "placeholder": "e.g. 12345"}
 * ]
 */

// ShowBox Scraper for Nuvio - Android TV Optimized
const TMDB_API_KEY = '439c478a771f35c05022f9feabcca01c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const SHOWBOX_API_BASE = 'https://febapi.nuvioapp.space/api/media';

const WORKING_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.91 Mobile Safari/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

// --- SETTINGS HANDLING ---
// This function pulls from the "Settings" UI you see in Nuvio
function getSettingsValue(key) {
    try {
        if (typeof global !== 'undefined' && global.SCRAPER_SETTINGS) {
            return global.SCRAPER_SETTINGS[key] || '';
        }
        if (typeof window !== 'undefined' && window.SCRAPER_SETTINGS) {
            return window.SCRAPER_SETTINGS[key] || '';
        }
    } catch (e) {
        console.error(`[ShowBox] Settings error: ${e.message}`);
    }
    return '';
}

// --- NETWORK HELPER ---
function makeRequest(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // Slightly longer for TV

    return fetch(url, {
        method: options.method || 'GET',
        headers: { ...WORKING_HEADERS, ...options.headers },
        signal: controller.signal,
        ...options
    }).then(function(response) {
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    }).catch(function(error) {
        clearTimeout(timeoutId);
        throw error;
    });
}

// --- UTILS ---
function getQuality(str) {
    if (!str) return 'Unknown';
    const s = str.toUpperCase();
    if (s.includes('2160') || s.includes('4K')) return '4K';
    if (s.includes('1080')) return '1080p';
    if (s.includes('720')) return '720p';
    return str;
}

function getTMDBDetails(tmdbId, type) {
    const url = `${TMDB_BASE_URL}/${type === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    return makeRequest(url)
        .then(res => res.json())
        .then(data => ({
            title: type === 'tv' ? data.name : data.title,
            year: (type === 'tv' ? data.first_air_date : data.release_date)?.split('-')[0] || ''
        }))
        .catch(() => ({ title: 'Media', year: '' }));
}

// --- MAIN SCRAPER LOGIC ---
function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    const cookie = getSettingsValue('uiToken');
    const ossGroup = getSettingsValue('ossGroup');

    // If UI Token is missing, we can't scrape
    if (!cookie) {
        console.log('[ShowBox] Error: Please enter UI Token in Scraper Settings');
        return Promise.resolve([]);
    }

    return getTMDBDetails(tmdbId, mediaType).then(info => {
        let apiUrl = (mediaType === 'tv') 
            ? `${SHOWBOX_API_BASE}/tv/${tmdbId}${ossGroup ? '/oss='+ossGroup : ''}/${seasonNum}/${episodeNum}?cookie=${encodeURIComponent(cookie)}`
            : `${SHOWBOX_API_BASE}/movie/${tmdbId}?cookie=${encodeURIComponent(cookie)}`;

        return makeRequest(apiUrl)
            .then(res => res.json())
            .then(data => {
                if (!data || !data.versions) return [];
                
                const streams = [];
                data.versions.forEach((v, idx) => {
                    if (!v.links) return;
                    v.links.forEach(l => {
                        const q = getQuality(l.quality);
                        streams.push({
                            name: `ShowBox ${q}`,
                            title: `${info.title} ${info.year ? '('+info.year+')' : ''}`,
                            url: l.url,
                            quality: q,
                            provider: 'showbox'
                        });
                    });
                });

                return streams.sort((a, b) => {
                    const rank = { '4K': 4, '1080p': 3, '720p': 2 };
                    return (rank[b.quality] || 0) - (rank[a.quality] || 0);
                });
            })
            .catch(() => []);
    });
}

// Ensure Nuvio can see the function
global.getStreams = getStreams;
if (typeof module !== 'undefined') module.exports = { getStreams };
