const puppeteer = require('puppeteer');

async function getStream(animeUrl) {
    console.log(`[Nuvio] Launching browser for: ${animeUrl}`);
    
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });

    const page = await browser.newPage();

    // 1. Set a realistic User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36');

    let streamUrl = null;

    // 2. Intercept Network Requests to find the .m3u8
    await page.setRequestInterception(true);
    page.on('request', request => {
        const url = request.url();
        if (url.includes('.m3u8') || url.includes('uwu.m3u8')) {
            streamUrl = url;
            console.log('[Nuvio] Found Stream Link:', streamUrl);
        }
        request.continue();
    });

    try {
        // 3. Navigate to the page
        await page.goto(animeUrl, { waitUntil: 'networkidle2', timeout: 60000 });

        // 4. If the page has a "Play" button or a redirect, we might need to click it
        // Note: AnimePahe often has a "redirect" page. 
        // We wait a few seconds for the player to initialize.
        await new Promise(r => setTimeout(r, 5000));

        if (!streamUrl) {
            console.log("[Nuvio] Stream not found automatically. Trying to click play...");
            // Force a click on the video container if needed
            await page.click('#player_over'); 
            await new Promise(r => setTimeout(r, 3000));
        }

    } catch (err) {
        console.error('[Nuvio] Error navigating:', err.message);
    } finally {
        await browser.close();
    }

    return streamUrl;
}

// --- Usage ---
// Use an actual AnimePahe episode page here, not the CDN link.
const episodePage = 'https://animepahe.si/play/your-episode-slug-here';

getStream(episodePage).then(url => {
    if(url) {
        console.log('SUCCESS: You can now pass this to FFmpeg:', url);
    } else {
        console.log('FAILED: Could not intercept the stream.');
    }
});
