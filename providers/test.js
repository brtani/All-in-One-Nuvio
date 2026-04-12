// Dahmer Movies Scraper - Enhanced Search & Quality Detection
// React Native compatible

console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';
const TIMEOUT = 60000;

function makeRequest(url) {
    return fetch(url, {
        timeout: TIMEOUT,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    }).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
    });
}

// Improved Quality Detection
function getQualityLabel(text) {
    const t = text.toLowerCase();
    if (t.includes('2160p') || t.includes('4k') || t.includes('uhd')) return '2160p';
    if (t.includes('1440p') || t.includes('2k')) return '1440p';
    if (t.includes('1080p')) return '1080p';
    if (t.includes('720p')) return '720p';
    if (t.includes('480p')) return '480p';
    return 'HD'; // Default fallback
}

function parseLinks(html) {
    const links = [];
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        const text = match[2].trim();
        // Skip navigation and system links
        if (!text || href === '../' || href.includes('?C=') || text.toLowerCase().includes('parent directory')) continue;
        links.push({ text, href });
    }
    return links;
}

async function invokeDahmerMovies(title, year, season = null, episode = null) {
    // Try multiple folder naming variations to increase "Find" rate
    const cleanTitle = title.replace(/:/g, '');
    const folderVariations = season === null 
        ? [`${cleanTitle} (${year})`, `${cleanTitle.replace(/ /g, '.')}.${year}`]
        : [`${title.replace(/:/g, ' -')}`, title.replace(/ /g, '.')];

    const pathType = season === null ? 'movies' : 'tvs';
    let html = '';
    let usedRequestUrl = '';

    // Loop through variations until one works
    for (const folder of folderVariations) {
        const tryUrl = `${DAHMER_MOVIES_API}/${pathType}/${encodeURIComponent(folder)}/`;
        try {
            const res = await makeRequest(tryUrl);
            html = await res.text();
            usedRequestUrl = tryUrl;
            if (html) break; 
        } catch (e) {
            continue; // Try next variation
        }
    }

    if (!html) return [];

    const paths = parseLinks(html);
    let filteredPaths;

    if (season === null) {
        // Accept ALL movie files (mkv/mp4/avi) regardless of quality tag
        filteredPaths = paths.filter(p => /\.(mkv|mp4|avi|mov)$/i.test(p.href));
    } else {
        const s = season < 10 ? `0${season}` : `${season}`;
        const e = episode < 10 ? `0${episode}` : `${episode}`;
        // Support both S01E01 and 1x01 formats
        const epPattern = new RegExp(`(S${s}E${e}|${season}x${e})`, 'i');
        filteredPaths = paths.filter(path => epPattern.test(path.text));
    }

    return filteredPaths.map(path => {
        const resolvedUrl = new URL(path.href, usedRequestUrl).href;
        
        // Final playback-safe encoding
        const finalUrl = decodeURIComponent(resolvedUrl)
            .replace(/ /g, '%20')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29');

        return {
            name: "DahmerMovies",
            title: `DahmerMovies ${path.text}`,
            url: finalUrl,
            quality: getQualityLabel(path.text),
            provider: "dahmermovies",
            filename: path.text
        };
    });
}

function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
    return makeRequest(tmdbUrl).then(res => res.json()).then(data => {
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        return invokeDahmerMovies(title, year ? parseInt(year) : null, seasonNum, episodeNum);
    }).catch(() => []);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
