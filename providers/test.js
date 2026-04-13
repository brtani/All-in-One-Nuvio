// Dahmer Movies Scraper - Linear High-Speed Fix
// Optimized for: Peaky Blinders (2025), Zootopia 2, Send Help, Mercy

console.log('[DahmerMovies] Initializing Final High-Speed Scraper');

const TMDB_API_KEY = "439c478a771f35c05022f9feabcca01c";
const DAHMER_MOVIES_API = 'https://a.111477.xyz';

async function makeRequest(url) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 12000); // 12s timeout

    return fetch(url, {
        signal: controller.signal,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    }).then(res => {
        clearTimeout(id);
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
        if (!text || href === '../' || href.includes('?C=')) continue;
        links.push({ text, href });
    }
    return links;
}

async function invokeDahmerMovies(title, year, season = null, episode = null) {
    const pathType = season === null ? 'movies' : 'tvs';
    const cleanTitle = title.replace(/:/g, '');
    
    // Most reliable variations based on your screenshots
    const variations = [
        `${cleanTitle} (${year})`,
        cleanTitle
    ];

    let html = '';
    let finalBaseUrl = '';

    // Linear check: Try Variation 1, if it fails, try Variation 2
    for (const folder of variations) {
        const enc = encodeURIComponent(folder).replace(/\(/g, '%28').replace(/\)/g, '%29');
        let tryUrl = `${DAHMER_MOVIES_API}/${pathType}/${enc}/`;
        
        if (season !== null) {
            const s = season < 10 ? '0' + season : season;
            tryUrl += `Season%20${s}/`;
        }

        try {
            console.log(`[DahmerMovies] Attempting: ${tryUrl}`);
            const res = await makeRequest(tryUrl);
            const text = await res.text();
            if (text && text.includes('<a')) {
                html = text;
                finalBaseUrl = tryUrl;
                break; // Found it! Stop searching.
            }
        } catch (e) {
            console.log(`[DahmerMovies] Failed variation: ${folder}`);
        }
    }

    if (!html) return [];

    const paths = parseLinks(html);
    
    // Filter logic: 
    // Movies = grab all video files (Zoomania fix)
    // TV = match episode pattern
    const filtered = (season !== null) 
        ? paths.filter(p => {
            const s = season < 10 ? `0${season}` : `${season}`;
            const e = episode < 10 ? `0${episode}` : `${episode}`;
            const pattern = new RegExp(`(S${s}E${e}|${season}x${e}|[\\s\\.\\-_]${e}[\\s\\.\\-_]|^${e}\\s)`, 'i');
            return pattern.test(p.text) || pattern.test(p.href);
          })
        : paths.filter(p => /\.(mkv|mp4|avi|webm)$/i.test(p.href));

    return filtered.map(path => {
        const resolved = new URL(path.href, finalBaseUrl).href;
        
        // Final playback-safe encoding
        const finalUrl = decodeURIComponent(resolved)
            .replace(/ /g, '%20')
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29');

        const t = path.text.toLowerCase();
        let q = 'HD';
        if (t.includes('2160') || t.includes('4k')) q = '2160p';
        else if (t.includes('1080')) q = '1080p';
        else if (t.includes('720')) q = '720p';

        return {
            name: "DahmerMovies",
            title: `DahmerMovies ${path.text}`,
            url: finalUrl,
            quality: q,
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
