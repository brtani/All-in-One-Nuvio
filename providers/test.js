// Dahmer Movies Scraper - Ultra Wide Compatibility Mode
// Fixed for: Peaky Blinders, Crime 101, Send Help

console.log('[DahmerMovies] Initializing Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';
const TIMEOUT = 60000;

async function makeRequest(url) {
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

function parseLinks(html) {
    const links = [];
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi;
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        const text = match[2].trim();
        if (!text || href === '../' || href.includes('?C=') || text.toLowerCase().includes('parent directory')) continue;
        links.push({ text, href });
    }
    return links;
}

async function invokeDahmerMovies(title, year, season = null, episode = null) {
    const pathType = season === null ? 'movies' : 'tvs';
    const cleanTitle = title.replace(/:/g, '');
    
    // Create a list of possible folder names the server might use
    const variations = [];
    if (season === null) {
        variations.push(`${cleanTitle} (${year})`);
        variations.push(cleanTitle);
        variations.push(cleanTitle.replace(/ /g, '.'));
    } else {
        variations.push(cleanTitle);
        variations.push(`${cleanTitle} -`); // Common for TV shows on this server
        variations.push(cleanTitle.replace(/ /g, '.'));
    }

    let html = '';
    let usedUrl = '';

    // Try every variation until we hit a valid directory
    for (const folder of variations) {
        const tryUrl = `${DAHMER_MOVIES_API}/${pathType}/${encodeURIComponent(folder)}/` + (season !== null ? `Season ${season}/` : '');
        try {
            const res = await makeRequest(tryUrl);
            html = await res.text();
            usedUrl = tryUrl;
            if (html && html.includes('<tr')) break;
        } catch (e) {}
    }

    if (!html) return [];

    const paths = parseLinks(html);
    let filteredPaths = paths;

    if (season !== null) {
        const s = season < 10 ? `0${season}` : `${season}`;
        const e = episode < 10 ? `0${episode}` : `${episode}`;
        // Matches S01E01, 1x01, or just " 01 "
        const epPattern = new RegExp(`(S${s}E${e}|${season}x${e}|[\\s\\.\\-]${e}[\\s\\.\\-])`, 'i');
        filteredPaths = paths.filter(p => epPattern.test(p.text) || epPattern.test(p.href));
    }

    return filteredPaths.map(path => {
        const resolvedUrl = new URL(path.href, usedUrl).href;
        
        // Final playback-safe encoding for spaces and ( )
        const finalUrl = decodeURIComponent(resolvedUrl)
            .replace(/ /g, '%20')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29');

        const t = path.text.toLowerCase();
        let quality = 'HD';
        if (t.includes('2160') || t.includes('4k')) quality = '2160p';
        else if (t.includes('1080')) quality = '1080p';
        else if (t.includes('720')) quality = '720p';

        return {
            name: "DahmerMovies",
            title: `DahmerMovies ${path.text}`,
            url: finalUrl,
            quality: quality,
            provider: "dahmermovies",
            filename: path.text
        };
    });
}

async function getStreams(tmdbId, mediaType = 'movie', seasonNum = null, episodeNum = null) {
    try {
        const tmdbUrl = `https://api.themoviedb.org/3/${mediaType === 'tv' ? 'tv' : 'movie'}/${tmdbId}?api_key=${TMDB_API_KEY}`;
        const res = await makeRequest(tmdbUrl);
        const data = await res.json();
        
        const title = mediaType === 'tv' ? data.name : data.title;
        const year = (mediaType === 'tv' ? data.first_air_date : data.release_date)?.substring(0, 4);
        
        return await invokeDahmerMovies(title, year ? parseInt(year) : null, seasonNum, episodeNum);
    } catch (e) {
        return [];
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getStreams };
} else {
    global.getStreams = getStreams;
}
