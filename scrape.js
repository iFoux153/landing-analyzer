const { chromium } = require('playwright');

async function scrapePage(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // laisse le JS se render

    // Screenshot desktop
    await page.screenshot({ path: 'screenshot-desktop.png', fullPage: true });

    // Screenshot mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'screenshot-mobile.png', fullPage: true });

    // Extraction du texte
    const content = await page.evaluate(() => {
      // Supprime les éléments inutiles
      const remove = ['script', 'style', 'noscript', 'svg', 'iframe'];
      remove.forEach(tag => {
        document.querySelectorAll(tag).forEach(el => el.remove());
      });

      // Extrait le texte structuré
      const title = document.title;
      const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
      const h1 = Array.from(document.querySelectorAll('h1')).map(el => el.innerText.trim()).filter(Boolean);
      const h2 = Array.from(document.querySelectorAll('h2')).map(el => el.innerText.trim()).filter(Boolean);
      const h3 = Array.from(document.querySelectorAll('h3')).map(el => el.innerText.trim()).filter(Boolean);
      const paragraphs = Array.from(document.querySelectorAll('p')).map(el => el.innerText.trim()).filter(Boolean);
      const buttons = Array.from(document.querySelectorAll('button, a[href]')).map(el => el.innerText.trim()).filter(s => s.length > 1 && s.length < 80);
      const bodyText = document.body.innerText;

      return { title, metaDesc, h1, h2, h3, paragraphs, buttons, bodyText: bodyText.slice(0, 8000) };
    });

    await browser.close();
    return content;

  } catch (err) {
    await browser.close();
    throw err;
  }
}

// CLI usage: node scrape.js <url>
const url = process.argv[2];
if (!url) {
  console.error('Usage: node scrape.js <url>');
  process.exit(1);
}

scrapePage(url)
  .then(content => console.log(JSON.stringify(content, null, 2)))
  .catch(err => { console.error(err.message); process.exit(1); });
