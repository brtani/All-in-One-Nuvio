// Dahmer Movies Scraper - Dynamic Search Mode
// Fixes: Peaky Blinders, Zootopia, Goat, Crime 101

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

// Cleans a string for comparison
const slugify = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

async function invokeDahmerMovies(title, year, season = null, episode = null) {
    const pathType = season === null ? 'movies' : 'tvs';
    const rootUrl = `${DAHMER_MOVIES_API}/${pathType}/`;
    
    // 1. Fetch the main directory to FIND the correct folder
    let rootHtml;
    try {
        const res = await makeRequest(rootUrl);
        rootHtml = await res.text();
    } catch (e) { return []; }

    const allFolders = parseLinks(rootHtml);
    const targetSlug = slugify(title);
    
    // 2. Find the folder that best matches our title
    const match = allFolders.find(f => {
        const folderSlug = slugify(decodeURIComponent(f.text));
        // Check if title matches, or title + year matches
        return folderSlug === targetSlug || folderSlug === slugify(`${title}${year}`);
    });

    if (!match) {
        console.log(`[DahmerMovies] No folder match found for: ${title}`);
        return [];
    }

    // 3. Enter the matched folder
    let targetUrl = new URL(match.href, rootUrl).href;
    if (season !== null) {
        targetUrl += `Season ${season}/`;
    }

    let folderHtml;
    try {
        const res = await makeRequest(targetUrl);
        folderHtml = await res.text();
    } catch (e) { return []; }

    const paths = parseLinks(folderHtml);
    let filteredPaths = paths;

    // 4. Handle TV Episode filtering
    if (season !== null) {
        const s = season < 10 ? `0${season}` : `${season}`;
        const e = episode < 10 ? `0${episode}` : `${episode}`;
        const epPattern = new RegExp(`(S${s}E${e}|${season}x${e}|[\\s\\.\\-]${e}[\\s\\.\\-])`, 'i');
        filteredPaths = paths.filter(p => epPattern.test(p.text) || epPattern.test(p.href));
    }

    return filteredPaths.map(path => {
        const resolvedUrl = new URL(path.href, targetUrl).href;
        
        // Final playback-safe encoding
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
