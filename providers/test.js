// Dahmer Movies Scraper - Final Stable Version
// Restored: Housemaid, Peaky Blinders, Crime 101, Zootopia, Goat

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
    
    // VARIATIONS: We try with and without years to catch "Goat" vs "Zootopia (2016)"
    const folderVariations = [];
    if (season === null) {
        folderVariations.push(`${cleanTitle} (${year})`);
        folderVariations.push(cleanTitle);
    } else {
        folderVariations.push(cleanTitle);
        folderVariations.push(`${cleanTitle} -`); 
    }

    let html = '';
    let finalBaseUrl = '';

    for (const folder of folderVariations) {
        let tryUrl = `${DAHMER_MOVIES_API}/${pathType}/${encodeURIComponent(folder)}/`;
        
        // Handle Season naming (Season 1 vs Season 01)
        if (season !== null) {
            const sSlug = season < 10 ? `0${season}` : season;
            // We try Season 01 first as it's the standard for this server
            tryUrl += `Season%20${sSlug}/`;
        }

        try {
            console.log(`[DahmerMovies] Trying: ${tryUrl}`);
            const res = await makeRequest(tryUrl);
            html = await res.text();
            finalBaseUrl = tryUrl;
            if (html && html.includes('<a')) break;
        } catch (e) {
            // If Season 01 fails, try Season 1
            if (season !== null) {
                let altUrl = `${DAHMER_MOVIES_API}/${pathType}/${encodeURIComponent(folder)}/Season%20${season}/`;
                try {
                    const resAlt = await makeRequest(altUrl);
                    html = await resAlt.text();
                    finalBaseUrl = altUrl;
                    if (html) break;
                } catch (err) {}
            }
            continue;
        }
    }

    if (!html) return [];

    const paths = parseLinks(html);
    let filteredPaths = paths;

    // Filter Episodes
    if (season !== null) {
        const s = season < 10 ? `0${season}` : `${season}`;
        const e = episode < 10 ? `0${episode}` : `${episode}`;
        const epPattern = new RegExp(`(S${s}E${e}|${season}x${e}|[\\s\\.\\-]${e}[\\s\\.\\-]|^${e}\\s)`, 'i');
        filteredPaths = paths.filter(p => epPattern.test(p.text) || epPattern.test(p.href));
    } else {
        // Filter Movies (only video extensions)
        filteredPaths = paths.filter(p => /\.(mkv|mp4|avi)$/i.test(p.href));
    }

    return filteredPaths.map(path => {
        // Resolve the link
        let resolvedUrl = new URL(path.href, finalBaseUrl).href;

        // Apply YOUR specific encoding requirements for ( ) and spaces
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
