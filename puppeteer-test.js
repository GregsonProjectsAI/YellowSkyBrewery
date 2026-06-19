const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        
        // Capture console logs
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        
        // Capture page errors
        page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
        
        // Capture request failures
        page.on('requestfailed', request => {
            console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
        });

        console.log('Navigating to localhost:3000...');
        await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' });
        
        console.log('Waiting for story button...');
        await page.waitForSelector('#story-open-btn');
        
        console.log('Clicking story button...');
        await page.click('#story-open-btn');
        
        console.log('Waiting 5 seconds...');
        await new Promise(r => setTimeout(r, 5000));
        
        console.log('Evaluating canvas presence...');
        const canvasExists = await page.evaluate(() => {
            const canvas = document.querySelector('canvas[data-webgpu="true"]') || document.querySelector('canvas');
            if (!canvas) return 'No canvas found';
            const rect = canvas.getBoundingClientRect();
            const styles = window.getComputedStyle(canvas);
            return {
                width: rect.width,
                height: rect.height,
                display: styles.display,
                visibility: styles.visibility,
                opacity: styles.opacity,
                zIndex: styles.zIndex,
                position: styles.position
            };
        });
        console.log('Canvas state:', canvasExists);

        await browser.close();
        console.log('Done.');
    } catch (err) {
        console.error('SCRIPT ERROR:', err);
    }
})();
