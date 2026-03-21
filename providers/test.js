// providers/superflix.js
// Upgraded SuperFlix Provider (Multi-Quality + Auto Best)

const BASE_URL = "https://superflixapi.rest";
const CDN_BASE = "https://llanfairpwllgwyngy.com";
const TMDB_API_KEY = "b64d2f3a4212a99d64a7d4485faed7b3";

let SESSION_DATA = {
    cookies: '',
    csrfToken: '',
    pageToken: ''
};

const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36';

const HEADERS = {
    'User-Agent': UA,
    'Accept': '*/*',
    'Referer': 'https://lospobreflix.site/'
};

const API_HEADERS = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'X-Requested-With': 'XMLHttpRequest',
    'Origin': BASE_URL
};

const VIDSRC_HEADERS = {
    'User-Agent': UA,
    'Referer': 'https://warezcdn.site/'
};

// ------------------ UTILS ------------------

function updateCookies(response) {
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) SESSION_DATA.cookies = setCookie;
}

function getCookieHeader() {
    return SESSION_DATA.cookies ? { Cookie: SESSION_DATA.cookies } : {};
}

function fixVideoUrl(url) {
    return url
        .replace(/tmstr\d+\.\{v\d+\}/g, 'tmstr2.neonhorizonworkshops.com')
        .replace(/\{v\d+\}/g, 'neonhorizonworkshops.com');
}

// ------------------ HLS PARSER ------------------

async function extractHlsVariants(masterUrl) {
    try {
        const res = await fetch(masterUrl);
        const text = await res.text();

        const lines = text.split('\n');
        const variants = [];

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('RESOLUTION=')) {
                const match = lines[i].match(/RESOLUTION=\d+x(\d+)/);
                const nextLine = lines[i + 1];

                if (match && nextLine && !nextLine.startsWith('#')) {
                    variants.push({
                        quality: parseInt(match[1]),
                        url: new URL(nextLine, masterUrl).href
                    });
                }
            }
        }

        variants.sort((a, b) => b.quality - a.quality);
        return variants;

    } catch (e) {
        console.log('[HLS ERROR]', e.message);
        return [];
    }
}

function pushResults(results, variants, fallbackUrl, title, headers) {
    if (variants.length > 0) {
        variants.forEach(v => {
            results.push({
                name: `SuperFlix ${v.quality}p`,
                title,
                url: v.url,
                quality: v.quality,
                headers
            });
        });
    } else {
        results.push({
            name: `SuperFlix`,
            title,
            url: fallbackUrl,
            quality: 720,
            headers
        });
    }
}

// ------------------ TMDB ------------------

async function getImdbIdFromTmdb(tmdbId, mediaType) {
    try {
        const type = mediaType === 'movie' ? 'movie' : 'tv';
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`);
        const data = await res.json();

        if (mediaType === 'movie') return data.imdb_id;

        const ext = await fetch(`https://api.themoviedb.org/3/tv/${tmdbId}/external_ids?api_key=${TMDB_API_KEY}`);
        const extData = await ext.json();
        return extData.imdb_id;

    } catch {
        return null;
    }
}

// ------------------ MAIN ------------------

async function getStreams(tmdbId, mediaType, season = 1, episode = 1) {
    const results = [];
    const title = mediaType === 'movie'
        ? `Movie ${tmdbId}`
        : `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`;

    try {
        // ------------------ VIDSRC (LEGENDADO) ------------------

        let vidsrcUrl = null;

        if (mediaType === 'movie') {
            const imdb = await getImdbIdFromTmdb(tmdbId, mediaType);
            if (imdb) vidsrcUrl = `https://vidsrc-embed.ru/embed/${imdb}`;
        } else {
            vidsrcUrl = `https://vsembed.ru/embed/${tmdbId}/${season}-${episode}`;
        }

        if (vidsrcUrl) {
            try {
                const res = await fetch(vidsrcUrl, { headers: VIDSRC_HEADERS });
                const html = await res.text();

                const iframe = html.match(/<iframe[^>]+src=["']([^"']+)/);
                if (iframe) {
                    let rcpUrl = iframe[1];
                    if (rcpUrl.startsWith('//')) rcpUrl = 'https:' + rcpUrl;

                    const rcp = await fetch(rcpUrl, { headers: VIDSRC_HEADERS });
                    const rcpHtml = await rcp.text();

                    const srcMatch = rcpHtml.match(/src:\s*['"]([^'"]+)/);
                    if (srcMatch) {
                        let videoUrl = fixVideoUrl(srcMatch[1]);

                        const variants = await extractHlsVariants(videoUrl);

                        pushResults(results, variants, videoUrl, title, {
                            Referer: 'https://cloudnestra.com/',
                            'User-Agent': UA
                        });
                    }
                }
            } catch (e) {
                console.log('[VIDSRC ERROR]', e.message);
            }
        }

        // ------------------ SUPERFLIX API (DUBLADO) ------------------

        const pageUrl = mediaType === 'movie'
            ? `${BASE_URL}/filme/${tmdbId}`
            : `${BASE_URL}/serie/${tmdbId}/${season}/${episode}`;

        const page = await fetch(pageUrl, { headers: HEADERS });
        updateCookies(page);

        const html = await page.text();

        const csrf = html.match(/CSRF_TOKEN\s*=\s*["']([^"']+)/)?.[1];
        const pageToken = html.match(/PAGE_TOKEN\s*=\s*["']([^"']+)/)?.[1];

        if (!csrf || !pageToken) return results;

        const contentId = html.match(/data-contentid=["'](\d+)/)?.[1];
        if (!contentId) return results;

        const params = new URLSearchParams({
            contentid: contentId,
            type: mediaType === 'movie' ? 'filme' : 'serie',
            _token: csrf,
            page_token: pageToken
        });

        const opt = await fetch(`${BASE_URL}/player/options`, {
            method: 'POST',
            headers: { ...API_HEADERS, ...getCookieHeader() },
            body: params
        });

        const data = await opt.json();

        for (const option of data?.data?.options || []) {
            if (option.type !== 1) continue;

            const srcParams = new URLSearchParams({
                video_id: option.ID,
                _token: csrf,
                page_token: pageToken
            });

            const src = await fetch(`${BASE_URL}/player/source`, {
                method: 'POST',
                headers: { ...API_HEADERS, ...getCookieHeader() },
                body: srcParams
            });

            const srcData = await src.json();
            if (!srcData?.data?.video_url) continue;

            const redirect = await fetch(srcData.data.video_url, { redirect: 'follow' });
            const playerUrl = redirect.url;
            const hash = playerUrl.split('/').pop();

            const video = await fetch(`${CDN_BASE}/player/index.php?data=${hash}&do=getVideo`, {
                method: 'POST',
                headers: { 'User-Agent': UA }
            });

            const videoData = await video.json();
            let finalUrl = videoData.securedLink || videoData.videoSource;

            if (!finalUrl) continue;

            finalUrl = fixVideoUrl(finalUrl);

            const variants = await extractHlsVariants(finalUrl);

            pushResults(results, variants, finalUrl, title, {
                Referer: CDN_BASE,
                'User-Agent': UA
            });
        }

        // ------------------ SORT BEST FIRST ------------------

        return results.sort((a, b) => b.quality - a.quality);

    } catch (e) {
        console.log('[PROVIDER ERROR]', e.message);
        return results;
    }
}

module.exports = { getStreams };
