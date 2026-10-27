const { chromium } = require('playwright');

(async () => {
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        
        console.log('Navigating to Vercel app...');
        await page.goto('https://offer-managment.vercel.app', { waitUntil: 'networkidle' });
        
        console.log('Done checking Vercel app.');
        await browser.close();
    } catch (e) {
        console.error('Script Error:', e);
    }
})();
