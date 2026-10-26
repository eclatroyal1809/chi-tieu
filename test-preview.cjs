const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  await page.evaluateHandle('document.fonts.ready');
  await new Promise(r => setTimeout(r, 1000));
  
  await page.screenshot({ path: 'screenshot.png' });
  console.log("Mobile screenshot saved to screenshot.png");
  
  await browser.close();
})();
